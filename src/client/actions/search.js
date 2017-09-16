export const SET_TWITTER_SEARCH = 'SET_TWITTER_SEARCH'
export const RESET_SEARCH = 'RESET_SEARCH'
export const SET_TWITTER_SEARCH_TWEETS = 'SET_TWITTER_SEARCH_TWEETS'
export const SET_TWITTER_SEARCH_USERS = 'SET_TWITTER_SEARCH_USERS'
export const SET_TWITTER_SEARCH_HASHTAGS = 'SET_TWITTER_SEARCH_HASHTAGS'
export const SET_TWITTER_SEARCH_SUMMARY = 'SET_TWITTER_SEARCH_SUMMARY'

const setTwitterSearch = (searchInfo) => {
  return {
    type: SET_TWITTER_SEARCH,
    searchInfo
  }
}

const resetSearch = () => {
  return {
    type: RESET_SEARCH,
  }
}

const setTwitterSearchTweets = (tweets) => {
  return {
    type: SET_TWITTER_SEARCH_TWEETS,
    tweets
  }
}

const setTwitterSearchUsers = (users) => {
  return {
    type: SET_TWITTER_SEARCH_USERS,
    users
  }
}

const setTwitterSearchHashtags = (hashtags) => {
  return {
    type: SET_TWITTER_SEARCH_HASHTAGS,
    hashtags
  }
}

const setTwitterSearchSummary = (summary) => {
  return {
    type: SET_TWITTER_SEARCH_SUMMARY,
    summary
  }
}

export const searchTwitter = (q) => {
  return (dispatch, getState) => {
    dispatch(resetSearch())
    const { user } = getState()
    const body = { user, q }
    const opts = {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body),
      redirect: 'follow',
      credentials: 'same-origin'
    }
    return fetch('/api/v1/searches', opts)
      .then((resp) => {
        resp.json().then((result) => {
          dispatch(setTwitterSearch(result))
        })
      })
  }
}

export const getTweets = (endpoint) => {
  return (dispatch) => {
    fetch(endpoint, {credentials: 'same-origin'})
      .then((resp) => resp.json())
      .then((result) => {
        dispatch(setTwitterSearchTweets(result))
      })
  }
}

export const getUsers = (endpoint) => {
  return (dispatch) => {
    fetch(endpoint, {credentials: 'same-origin'})
      .then((resp) => resp.json())
      .then((result) => {
        dispatch(setTwitterSearchUsers(result))
      })
  }
}

export const getHashtags = (endpoint) => {
  return (dispatch) => {
    fetch(endpoint, {credentials: 'same-origin'})
      .then((resp) => resp.json())
      .then((result) => {
        dispatch(setTwitterSearchHashtags(result))
      })
  }
}

export const getSearchSummary = (endpoint) => {
  return (dispatch) => {
    fetch(endpoint, {credentials: 'same-origin'})
      .then((resp) => resp.json())
      .then((result) => {
        dispatch(setTwitterSearchSummary(result))
      })
  }
}
