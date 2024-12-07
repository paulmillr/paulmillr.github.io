import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { Event } from 'nostr-tools'
import type { Author } from '@/types'
import { getDisplayUsername } from '@/utils/utils'

export const useOwnProfile = defineStore('ownProfile', () => {
  const contactsEvent = ref(<Event | null>{})
  const metaEvent = ref(<Event | null>null)
  const metaContent = ref(<Author | null>null)

  const username = computed(() => {
    if (!metaContent.value || !metaEvent.value) {
      return ''
    }
    return getDisplayUsername(metaContent.value, metaEvent.value.pubkey)
  })

  const pubkey = computed(() => {
    return metaEvent.value ? metaEvent.value.pubkey : ''
  })

  function updateContactsEvent(value: Event) {
    contactsEvent.value = value
  }

  function updateMeta(value: Event) {
    metaEvent.value = value
    metaContent.value = JSON.parse(value.content)
  }

  return { contactsEvent, updateContactsEvent, updateMeta, username, pubkey }
})
