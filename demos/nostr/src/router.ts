import { createRouter, createWebHashHistory } from 'vue-router'

const Feed = () => import('./views/Feed.vue');
const MessageInput = () => import('./components/MessageInput.vue')
const SignedEventInput = () => import('./components/SignedEventInput.vue')
const Help = () => import('./components/Help.vue')

// TODO: fix and replace with: const User = () => import('./components/User.vue')
import User from './components/User.vue'

const routes = [
  { 
    path: '/', 
    name: 'Feed', 
    components: { 
      default: Feed,
      messageInput: MessageInput
    }, 
    alias: ['/feed']
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
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  // @ts-ignore 
  routes
})

export default router