<script setup lang="ts">
  import { onMounted, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import type { EventExtended, EventTextPart, ContentPart } from '../../types'
  import { useNpub } from '@/stores/Npub'
  import { useUser } from '@/stores/User'
  import {
    splitEventContentByParts,
    getPartsContentLengthByText,
  } from '@/components/EventText/EventTextUtils'

  const props = defineProps<{
    event: EventExtended
    slice?: boolean
  }>()
  const router = useRouter()
  const npubStore = useNpub()
  const userStore = useUser()

  const contentParts = ref<EventTextPart[]>([])
  const sliceContent = ref(props.slice ?? true)
  const toggleMore = ref(false)

  onMounted(() => {
    const parts = splitEventContentByParts(props.event, sliceContent.value)
    contentParts.value = parts
    toggleMore.value = isShowMoreBtnNeeded(parts)
  })

  const isShowMoreBtnNeeded = (parts: ContentPart[]) => {
    return props.slice && props.event.content.length > getPartsContentLengthByText(parts)
  }

  const handleClickMention = (mentionNpub: string | undefined) => {
    if (!mentionNpub) return
    npubStore.updateNpubInput(mentionNpub)
    userStore.updateRoutingStatus(true)
    router.push({ path: `/user/${mentionNpub}` })
  }

  const toggleShowMore = () => {
    sliceContent.value = !sliceContent.value
    contentParts.value = splitEventContentByParts(props.event, sliceContent.value)
  }
</script>

<template>
  <div class="event-content">
    <span v-for="(part, i) in contentParts" v-bind:key="i">
      <span v-if="part.type === 'text'">
        {{ part.value }}
      </span>
      <span v-if="part.type === 'profile'">
        <a @click.prevent="() => handleClickMention(part.npub)" href="#">
          {{ part.value }}
        </a>
      </span>
    </span>
  </div>
  <div v-if="toggleMore">
    <span class="show-more" @click="toggleShowMore">
      Show {{ sliceContent ? 'more' : 'less' }}
    </span>
  </div>
</template>

<style scoped>
  .event-content {
    white-space: pre-line;
    word-break: break-word;
  }

  .show-more {
    color: #0092bf;
    cursor: pointer;
  }
</style>
