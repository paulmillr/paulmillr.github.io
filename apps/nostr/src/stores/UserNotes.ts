import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { EventExtended } from '@/types'

export const useUserNotes = defineStore('user-notes', () => {
  const notes = ref<EventExtended[]>([])  // only shown in view, by default 20 notes
  const allNotesIds = ref<string[]>([])
 
  function updateNotes(events: EventExtended[]) {
    notes.value = events
  }

  function updateIds(value: string[]) {
    allNotesIds.value = value
  }

  function toggleRawData(id: string) {
    const event = notes.value.find(e => e.id === id)
    if (event) {
      event.showRawData = !event.showRawData
    }
  }

  return { notes, allNotesIds, updateNotes, updateIds, toggleRawData }
})