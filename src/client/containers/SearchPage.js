import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import Search from '../components/Search'
import { searchTwitter, getSearch, getTweets, getUsers, getHashtags,
  getUrls, getPhotos, updateSearch } from '../actions/search'

const mapStateToProps = (state, ownProps) => {
  return {
    q: ownProps.match.params.q,
    id: state.search.id,
    tweets: state.search.tweets,
    hashtags: state.search.hashtags,
    users: state.search.users,
    urls: state.search.urls,
    photos: state.search.photos,
    maxDate: state.search.maxDate,
    minDate: state.search.minDate,
    count: state.search.count,
    active: state.search.active
  }
}

const actions = {
  searchTwitter,
  getSearch,
  getTweets,
  getUsers,
  getHashtags,
  getUrls,
  getPhotos,
  updateSearch
}

const mapDispatchToProps = (dispatch) => bindActionCreators(actions, dispatch)

export default connect(mapStateToProps, mapDispatchToProps)(Search)
