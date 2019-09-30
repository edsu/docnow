import React from 'react'
import PropTypes from 'prop-types'
import MediaQueryComponent from './MediaQueryComponent'

import Tabs from '@material-ui/core/Tabs'
import Tab from '@material-ui/core/Tab'

import styles from './TabBar.css'

export default class TabBarComponent extends MediaQueryComponent {
  constructor(props) {
    super(props)
    this.links = [
      {dest: '/', label: 'Trending', icon: 'analytics'},
      {dest: '/explore/', label: 'Explore', icon: 'search'}, 
      {dest: '/searches/', label: 'Saved Searches', icon: 'filing'},
    ]
    if (props.isSuperUser) {
      this.links.push({dest: '/users/', label: 'Users', icon: 'person'})
    }
  }

  componentDidMount() {
    this.setMediaQuery('(max-width: 480px)', '', styles.NoLabel)
  }

  render() {
    let activeIndex = null
    switch (this.props.location) {
      case '/':
        activeIndex = 0
        break
      case '/explore/':
        activeIndex = 1
        break
      case '/searches/':
        activeIndex = 2
        break
      case '/users/':
        activeIndex = 3
        break
      default:
        if (this.props.location.match('/search/')) {
          activeIndex = 2
        }
    }

    return (
      <Tabs
        className={styles.TabBar}
        variant="fullWidth"
        value={activeIndex}
        indicatorColor="secondary"
        textColor="secondary"
        aria-label="nav tabs example"
      >{
        this.links.map((link, i) => {
          return (
            <Tab key={`l-${i}`} component="a" onClick={e => {
                e.preventDefault()
                this.props.navigateTo(this.links[i].dest)
              }}
              className={styles.Tab}
              icon={<ion-icon name={link.icon} style={{fontSize: '180%'}}></ion-icon>}
              label={<span className={`${styles.Label} ${this.state.mediaStyle}`}>{link.label}</span>}
              id={`nav-tab-${i}`}
            />
          )
        })
      }</Tabs>     
    )
  }

}

TabBarComponent.propTypes = {
  location: PropTypes.string,
  isSuperUser: PropTypes.bool,
  navigateTo: PropTypes.func
}
