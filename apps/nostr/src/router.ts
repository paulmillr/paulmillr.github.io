import { createRouter, createWebHashHistory } from 'vue-router'
import Feed from '@/views/Feed.vue'
import Help from '@/components/Help.vue'
import User from '@/views/User.vue'
import Settings from '@/views/Settings.vue'
import Chat from '@/views/Chat.vue'
import Login from '@/views/Login.vue'
import Header from '@/components/Header.vue'

const routes = [
  {
    path: '/feed',
    name: 'Feed',
    components: {
      default: Feed,
      Header: Header,
    },
  },
  {
    path: '/message',
    name: 'Message',
    components: {
      default: Feed,
      Header: Header,
    },
  },
  {
    path: '/chat',
    name: 'Chat',
    components: {
      default: Chat,
      Header: Header,
    },
  },
  // {
  //   path: '/log',
  //   name: 'Log',
  //   components: {
  //     default: Feed,
  //     Header: Header,
  //   },
  // },
  {
    path: '/user',
    name: 'Search',
    alias: ['/event'],
    components: {
      default: User,
      Header: Header,
    },
  },
  {
    path: '/user/:id',
    name: 'Search',
    alias: ['/event/:id'],
    components: {
      default: User,
      Header: Header,
    },
  },
  {
    path: '/help',
    name: 'Help',
    components: {
      default: Help,
      Header: Header,
    },
  },
  {
    path: '/',
    components: {
      default: Help,
      Header: Header,
    },
    beforeEnter: (to: any, from: any, next: any) => {
      const userId = to.query.user
      const eventId = to.query.event
      if (userId?.length) {
        next({ path: `/user/${userId}` })
      } else if (eventId?.length) {
        next({ path: `/event/${eventId}` })
      } else {
        next()
      }
    },
  },
  {
    path: '/settings',
    components: {
      default: Settings,
      Header: Header,
    },
  },
  {
    path: '/login',
    component: Login,
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  // @ts-ignore
  routes,
})

export default router
