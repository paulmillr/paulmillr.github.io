import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useImages = defineStore('images', () => {
  const showImages = ref(false)

  function updateShowImages(value: boolean) {
    showImages.value = value
  }

  return { showImages, updateShowImages }
})