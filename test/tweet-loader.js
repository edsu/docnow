import { Database } from '../src/server/db'
import { ok, equal, deepEqual } from 'assert'
import { TweetLoader, TweetLoaderController } from '../src/server/tweet-loader'

const db = new Database({redis: {db: 9}, es: {prefix: 'test'}})
let user = null
let search = null

describe('tweet-loader', () => {

  it('should setup', async () => {

    await db.clear()
    await db.setupIndexes()

    await db.addSettings({
      appKey: process.env.CONSUMER_KEY,
      appSecret: process.env.CONSUMER_SECRET
    })

    user = await db.addUser({
      name: "Ed Summers",
      location: "Silver Spring, MD",
      twitterScreenName: "edsu",
      twitterUserId: "1234",
      twitterAccessToken: process.env.ACCESS_TOKEN,
      twitterAccessTokenSecret: process.env.ACCESS_TOKEN_SECRET
    })

    search = await db.createSearch(user, [
      {type: 'keyword', value: 'obama'}
    ])

  })

  it('should load tweets', (done) => {
    const loader = new TweetLoader(db)
    const controller = new TweetLoaderController()

    loader.start()

    setTimeout(() => {
      controller.startStream(search.id)
    }, 1000)

    setTimeout(() => {
      controller.stopStream(search.id)
    }, 5000)

    setTimeout(() => {
      controller.stop()
      loader.stop()
      db.close()
      done()
    }, 10000)

  })

})
