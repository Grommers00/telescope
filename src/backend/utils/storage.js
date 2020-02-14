const { redis } = require('../lib/redis');

// Redis Keys
const feedsKey = 't:feeds';
const postsKey = 't:posts';
const usersKey = 't:users';

// Namespaces
const feedNamespace = 't:feed:';
const postNamespace = 't:post:';
const userNamespace = 't:users';
// Suffix
const invalidSuffix = ':invalid';

// "6Xoj0UXOW3" to "t:post:6Xoj0UXOW3"
const createPostKey = id => postNamespace.concat(id);
// "NirlSYranl" to "t:feed:NirlSYranl"
const createFeedKey = id => feedNamespace.concat(id);
// "NirlSYranl" to "t:feed:NirlSYranl:invalid"
const createInvalidFeedKey = id => createFeedKey(id).concat(invalidSuffix);
// "ABDFC44447" to "t:user:ABDFC44447"
const createUserKey = id => userNamespace.concat(id);

module.exports = {
  /**
   * Feeds
   */
  addFeed: async feed => {
    const key = createFeedKey(feed.id);
    await redis
      .multi()
      // Using hmset() until hset() fully supports multiple fields:
      // https://github.com/stipsan/ioredis-mock/issues/345
      // https://github.com/luin/ioredis/issues/551
      .hmset(
        key,
        'id',
        feed.id,
        'author',
        feed.author,
        'url',
        feed.url,
        'etag',
        feed.etag,
        'lastModified',
        feed.lastModified
      )
      .sadd(feedsKey, feed.id)
      .exec();
  },

  getFeeds: () => redis.smembers(feedsKey),

  getFeed: id => redis.hgetall(feedNamespace.concat(id)),

  getFeedsCount: () => redis.scard(feedsKey),

  setInvalidFeed: (id, reason) => {
    const key = createInvalidFeedKey(id);
    redis.set(key, reason);
  },

  isInvalid: id => redis.exists(createInvalidFeedKey(id)),

  /**
   * Posts
   */
  addPost: async post => {
    const key = createPostKey(post.id);
    await redis
      .multi()
      .hmset(
        key,
        'id',
        post.id,
        'author',
        post.author,
        'title',
        post.title,
        'html',
        post.html,
        'published',
        post.published,
        'updated',
        post.updated,
        'url',
        post.url,
        'site',
        post.site,
        'guid',
        post.guid
      )
      // sort set by published date as scores
      .zadd(postsKey, post.published.getTime(), post.id)
      .exec();
  },

  /**
   * Returns an array of post ids from redis
   * @param from lower index
   * @param to higher index, it needs -1 because redis includes the element at this index in the returned array
   * @return Array of ids
   */
  getPosts: (from, to) => redis.zrevrange(postsKey, from, to - 1),

  /**
   * Returns an array of post ids from redis
   * @param start starting Date in the range
   * @param end ending Date in the range
   * @return Array of ids
   */
  getPostsByDate: (startDate, endDate) =>
    redis.zrangebyscore(postsKey, startDate.getTime(), endDate.getTime()),

  getPostsCount: () => redis.zcard(postsKey),

  getPost: id => redis.hgetall(postNamespace.concat(id)),

  addUser: async user => {
    // not sure if this should be id or email or even name (for when we switch to seneca))
    const key = createUserKey(user.id);
    await redis
      .multi()
      // Using hmset() until hset() fully supports multiple fields:
      // https://github.com/stipsan/ioredis-mock/issues/345
      // https://github.com/luin/ioredis/issues/551
      .hmset(key, 'id', user.id, 'feedUrl', user.feedUrl)
      .sadd(usersKey, user.id)
      .exec();
  },

  getUserFeed: id => redis.hgetall(userNamespace.concat(id)),

  getUsersFeeds: () => redis.smembers(usersKey),
};
