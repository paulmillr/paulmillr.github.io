import { createRouter, createWebHashHistory } from 'vue-router'

const Feed = () => import('./views/Feed.vue');
const MessageInput = () => import('./components/MessageInput.vue')
const SignedEventInput = () => import('./components/SignedEventInput.vue')
const Help = () => import('./components/Help.vue')

// TODO: fix and replace with: const User = () => import('./components/User.vue')
import User from './components/User.vue'

const routes = [
  { 
    path: '/feed', 
    name: 'Feed', 
    components: { 
      default: Feed,
      messageInput: MessageInput
    },
  },
  { 
    path: '/message', 
    name: 'Message', 
    components: {
      default: Feed,
      signedEventInput: SignedEventInput
    },
  },
  {
    path: '/log',
    name: 'Log',
    components: {
      default: Feed,
      messageInput: MessageInput
    },
  },
  {
    path: '/user',
    name: 'User',
    component: User,
    alias: ['/event']
  },
  { 
    path: '/user/:id', 
    component: User,
    alias: ['/event/:id']
  },
  {
    path: '/help',
    name: 'Help',
    component: Help
  },
  {
    path: '/',
    component: Help,
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
    }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  // @ts-ignore 
  routes
})

export default router