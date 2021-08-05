import express from 'express'
import multiparty from 'multiparty'
import * as fs from 'fs'
import log from './logger'
import wayback from './wayback'

import { Database } from './db'
import { Archive } from './archive'
import { activateKeys } from './auth'
import { StreamLoaderController } from './stream-loader'

const app = express()

const db = new Database()

const streamLoader = new StreamLoaderController()

db.startTrendsWatcher({interval: 60 * 1000})

function notAuthorized(res) {
  res.status(401).json({error: 'Not Authorized'})
}

app.get('/setup', (req, res) => {
  db.getSettings()
    .then((result) => {
      if (result && result.appKey && result.appSecret) {
        res.json(true)
      } else {
        res.json(false)
      }
    })
    .catch(() => {
      res.json(false)
    })
})

app.get('/user', (req, res) => {
  if (req.user) {
    db.getUser(req.user.id)
      .then((user) => {
        delete user.twitterAccessToken
        delete user.twitterAccessTokenSecret
        res.json(user)
      })
      .catch(() => {
        res.status(401)
        res.json({message: 'no such user'})
      })
  } else {
    notAuthorized(res)
  }
})

app.put('/user', async (req, res) => {
  if (req.user) {
    // fold selected new values into the existing user
    const user = await db.getUser(req.user.id)
    const newUser = {
      ...user,
      email: req.body.email,
    }
    await db.updateUser(newUser)
    res.json(newUser)
  } else {
    notAuthorized(res)
  }
})

app.put('/user/:userId', async (req, res) => {
  if (req.user && req.user.isSuperUser) {
    const user = await db.getUser(req.params.userId)
    const newUser = {
      ...user,
      ...req.body
    } 
    await db.updateUser(newUser)
    res.json(newUser)
  } else {
    notAuthorized(res)
  }
})


app.get('/settings', async (req, res) => {
  const settings = await db.getSettings()
  // if they aren't logged in or the they're not an admin
  // be sure to delete the app key settings!
  if (! req.user || (req.user && ! req.user.isSuperUser)) {
    delete settings.appKey
    delete settings.appSecret
  }
  res.json(settings)
})

app.put('/settings', async (req, res) => {
  // only allow super user to update the settings
  // or when there is no super user yet during initial setup
  const superUser = await db.getSuperUser()
  if (! superUser || (req.user && req.user.isSuperUser)) {
    const settings = {
      logoUrl: req.body.logoUrl,
      instanceTitle: req.body.instanceTitle,
      appKey: req.body.appKey,
      appSecret: req.body.appSecret,
      instanceInfoLink: req.body.instanceInfoLink,
      instanceDescription: req.body.instanceDescription,
      instanceTweetText: req.body.instanceTweetText,
      emailHost: req.body.emailHost,
      emailPort: req.body.emailPort,
      emailUser: req.body.emailUser,
      emailPassword: req.body.emailPassword,
      emailFromAddress: req.body.emailFromAddress,
      defaultQuota: parseInt(req.body.defaultQuota, 10) || 50000,
    }
    try {
      await db.addSettings(settings)
      activateKeys()
      res.json({status: 'updated'})
    } catch (err) {
      console.error(err)
      res.json({status: 'error'})
    }
  } else {
    notAuthorized(res)
  }

})

app.get('/world', (req, res) => {
  db.getPlaces().then((places) => {
    const world = {}
    for (const place of places) {
      world[place.id] = place
    }
    res.json(world)
  })
})

app.get('/trends', async (req, res) => {
  let results = null
  if (req.user) {
    results = await db.getUserTrends(req.user)
  } else {
    const user = await db.getSuperUser()
    results = await db.getUserTrends(user)
  }
  res.json(results)
})

app.put('/trends', async (req, res) => {
  if (req.user) {
    let user = await db.getUser(req.user.id)

    // create sparse object of places with the place ids
    const newPlaceIds = req.body
    user.places = newPlaceIds.map(placeId => ({id: placeId}))

    // update the users place ids
    user = await db.updateUser(user)

    // load latest data for these places
    for (const place of user.places) {
      await db.importLatestTrendsForPlace(place, user)
    }

    res.json({status: 'updated'})
  } else {
    notAuthorized(res)
  }
})

app.post('/logo', (req, res) => {
  if (req.user) {
    if (req.user.isSuperUser) {
      const form = new multiparty.Form()

      form.parse(req, (parseErr, fields, files) => {
        const {path} = files.imageFile[0]
        const newPath = './userData/images/logo.png'

        fs.readFile(path, (readErr, data) => {
          if (readErr) {
            log.error(readErr)
          } else {
            fs.writeFile(newPath, data, (writeErr) => {
              if (writeErr) {
                log.error(writeErr)
              } else {
                fs.unlink(path, () => {
                  res.send('File uploaded to: ' + newPath)
                })
              }
            })
          }
        })
      })
    }
  } else {
    notAuthorized(res)
  }
})

app.get('/searches', (req, res) => {
  // if the user is logged in and they aren't asking for public searches
  if (req.user && ! req.query.public) {
    let userId = req.user.id
    if (req.query.userId && req.user.isSuperUser) {
      userId = req.query.userId
    }
    db.getUserSearches({id: userId}).then(searches => {
      res.json(searches)
    })
  } else {
    // otherwise they just get the public
    db.getPublicSearches().then(searches => {
      res.json(searches)
    })
  }
})

app.post('/searches', (req, res) => {
  if (req.user) {

    const searchInfo = {
      userId: req.user.id,
      title: req.body.query.map(o => o.value).join(' '),
      queries: [{value: {or: req.body.query}}]
    }

    db.createSearch(searchInfo)
      .then((search) => {
        db.importFromSearch(search)
        res.redirect(303, `/api/v1/search/${search.id}`)
      })
      .catch((e) => {
        const msg = 'unable to createSearch: ' + e
        log.error(msg)
        res.error(msg)
      })
  } else {
    notAuthorized(res)
  }
})

app.get('/search/:searchId', async (req, res) => {
  if (req.user) {
    const search = await db.getSearch(req.params.searchId)
    const summ = await db.getSearchSummary(search)
    const lastQuery = summ.queries[summ.queries.length - 1]
    summ.query = lastQuery.value.or
    res.json(summ)
  } else {
    const search = await db.getPublicSearch(req.params.searchId)
    if (search) {
      const summ = await db.getSearchSummary(search)
      const lastQuery = summ.queries[summ.queries.length - 1]
      summ.query = lastQuery.value.or
      res.json(summ)
    } else {
      res.status(401).json({error: 'Not Authorized'})
    }
  }
})

app.put('/search/:searchId', async (req, res) => {
  if (req.user) {
    const search = await db.getSearch(req.body.id)
    const newSearch = {...search, ...req.body}
    await db.updateSearch(newSearch)

    if (req.query.refreshTweets) {
      db.importFromSearch(search)
    } else if (search.active && ! newSearch.active) {
      streamLoader.stopStream(search.id)
      // stop search too?
    } else if (! search.active && newSearch.active) {
      const twtr = await db.getTwitterClientForUser(req.user)
      const tweetId = await twtr.sendTweet({
        userId: req.user.id,
        text: search.tweetText
      })
      streamLoader.startStream(search.id, tweetId)
      // start search too?
    } else if (! search.archiveStarted && newSearch.archiveStarted) {
      const archive = new Archive()
      archive.createArchive(search)
    }
    res.json(newSearch)
  } else {
    notAuthorized(res)
  }
})

app.delete('/search/:searchId', async (req, res) => {
  if (req.user) {
    const search = await db.getSearch(req.body.id)
    const userOwnsSearch = search && search.userId == req.user.id
    if (userOwnsSearch || req.user.admin) {
      const result = await db.deleteSearch(search)
      res.json(result)
    } else {
      notAuthorized(res)
    }
  } else {
    notAuthorized(res)
  }
})

app.get('/search/:searchId/tweets', (req, res) => {
  let searchReq = null
  if (req.user) {
    searchReq = db.getSearch(req.params.searchId)
  } else {
    searchReq = db.getPublicSearch(req.params.searchId)
    if (!searchReq) {
      return notAuthorized(res)
    }
  }
  searchReq.then((search) => {
    if (req.query.url) {
      db.getTweetsForUrl(search, req.query.url)
        .then((tweets) => {
          res.json(tweets)
        })
    } else if (req.query.mine) {
      if (req.user) {
        db.getTweetsForUser(search, req.user.twitterUserId)
          .then((tweets) => {
            res.json(tweets)
          })
       } else {
         res.json([])
       }
    } else if (req.query.image) {
      db.getTweetsForImage(search, req.query.image)
        .then((tweets) => {
          res.json(tweets)
        })          
    } else if (req.query.video) {
      db.getTweetsForVideo(search, req.query.video)
        .then((tweets) => {
          res.json(tweets)
        })          
    } else if (req.query.ids) {
      db.getTweetsByIds(search, req.query.ids.split(','))
        .then((tweets) => {
          res.json(tweets)
        })          
    } else {
      const includeRetweets = req.query.includeRetweets ? true : false
      const offset = req.query.offset ? req.query.offset : 0
      const limit = req.query.limit ? req.query.limit : 100
      db.getTweets(search, includeRetweets, offset, limit)
        .then((tweets) => {
          res.json(tweets)
        })
    }
  })
})

app.put('/search/:searchId/tweets', async (req, res) => {
  if (req.user) {
    const userId = req.user.id
    const twitterUserId = req.user.twitterUserId
    const searchId = req.body.searchId
    const tweetIds = req.body.tweetIds
    const result = await db.deleteTweets(searchId, tweetIds, twitterUserId)
    res.json({
      message: `Deleted ${result} tweets (${tweetIds}) from ${searchId} for ${userId}:${twitterUserId}`
    })
  } else {
    notAuthorized(res)
  }
})

app.get('/search/:searchId/users', (req, res) => {
  let searchReq = null
  if (req.user) {
    searchReq = db.getSearch(req.params.searchId)
  } else {
    searchReq = db.getPublicSearch(req.params.searchId)
    if (!searchReq) {
      return res.status(401).json({error: 'Not Authorized'})
    }
  }
  searchReq.then((search) => {
    const offset = req.query.offset ? req.query.offset : 0
    const limit = req.query.limit ? req.query.limit : 100
    db.getTwitterUsers(search, offset, limit)
      .then((users) => {
        res.json(users)
      })
  })
})

app.get('/search/:searchId/hashtags', (req, res) => {
  if (req.user) {
    db.getSearch(req.params.searchId)
      .then((search) => {
        db.getHashtags(search)
          .then((hashtags) => {
            res.json(hashtags)
          })
      })
  } else {
    notAuthorized(res)
  }
})

app.get('/search/:searchId/urls', (req, res) => {
  if (req.user) {
    db.getSearch(req.params.searchId)
      .then((search) => {
        db.getUrls(search)
          .then((urls) => {
            res.json(urls)
          })
      })
  } else {
    notAuthorized(res)
  }
})

app.get('/search/:searchId/images', (req, res) => {
  if (req.user) {
    db.getSearch(req.params.searchId)
      .then((search) => {
        db.getImages(search)
          .then((images) => {
            res.json(images)
          })
      })
  } else {
    notAuthorized(res)
  }
})

app.get('/search/:searchId/videos', (req, res) => {
  if (req.user) {
    db.getSearch(req.params.searchId)
      .then((search) => {
        db.getVideos(search)
          .then((videos) => {
            res.json(videos)
          })
      })
  } else {
    notAuthorized(res)
  }
})

app.get('/search/:searchId/webpages', async (req, res) => {
  if (req.user) {
    const search = await db.getSearch(req.params.searchId)
    const webpages = await db.getWebpages(search)
    res.json(webpages)
  } else {
    notAuthorized(res)
  }
})

app.put('/search/:searchId/webpages', async (req, res) => {
  if (req.user) {
    const search = await db.getSearch(req.params.searchId)
    const url = req.body.url

    if (req.body.selected === true) {
      await db.selectWebpage(search, url)
    } else if (req.body.deselected === true) {
      await db.deselectWebpage(search, url)
    }
    res.json({status: 'updated'})
  } else {
    notAuthorized(res)
  }
})

app.get('/search/:searchId/queue', async (req, res) => {
  if (req.user) {
    const search = await db.getSearch(req.params.searchId)
    const result = await db.queueStats(search)
    res.json(result)
  } else {
    notAuthorized(res)
  }
})

app.get('/search/:searchId/actions', async (req, res) => {
  if (req.user) {
    const search = await db.getSearch(req.params.searchId)
    const userOwnsSearch = search.userId == req.user.id

    let actions = null
    if (req.query.all && (userOwnsSearch || req.user.admin || req.user.isSuperUser)) {
      // get all actions
      actions = await db.getActions(search)
    } else {
      // get only actions for a the authenticated user
      actions = await db.getActions(search, req.user)
    }

    res.json(actions)
  } else {
    notAuthorized(res)
  }
})

app.put('/search/:searchId/actions', async (req, res) => {
  if (req.user) {
    const search = await db.getSearch(req.params.searchId)
    await db.setActions(search, req.user, req.body.tweets, req.body.action.label, req.body.action.remove)
    const actions = await db.getActions(search, req.user)
    res.json(actions)
  } else {
    notAuthorized(res)
  }
})

app.get('/actions', async (req, res) => {
  if (req.user) {
    const actions = await db.getUserActions(req.user)
    res.json(actions)
  } else {
    notAuthorized(res)
  }
})

app.get('/wayback/:url', async (req, res) => {
  if (req.user) {
    const result = await wayback.closest(req.params.url)
    res.json(result)
  } else {
    notAuthorized(res)
  }
})

app.put('/wayback/:url', async (req, res) => {
  if (req.user) {
    const result = await wayback.saveArchive(req.params.url)
    res.json(result)
  } else {
    notAuthorized(res)
  }
})

app.get('/stats', async (req, res) => {
  if (req.user) {
    res.json(await db.getSystemStats())
  } else {
    notAuthorized(res)
  }
})

app.get('/users', async (req, res) => {
  if (req.user.isSuperUser) {
    res.json(await db.getUsers())
  } else {
    notAuthorized(res)
  }
})

app.get('/findme', async (req, res) => {
  if (req.user) {
    const results = await db.getSearchesWithUser(req.user.twitterScreenName)
    res.json(results)
  } else {
    notAuthorized(res)
  }
})

module.exports = app
