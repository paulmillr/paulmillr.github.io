import { createRouter, createWebHashHistory } from 'vue-router'
import Feed from '@/views/Feed.vue'
import MessageInput from '@/components/MessageInput.vue'
import SignedEventInput from '@/components/SignedEventInput.vue'
import Help from '@/components/Help.vue'
import User from '@/components/User.vue'
import Settings from '@/views/Settings.vue'

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
  },
  {
    path: '/settings',
    component: Settings
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  // @ts-ignore 
  routes
})

export default router