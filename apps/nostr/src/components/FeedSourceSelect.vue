<script setup lang="ts">
  import { useNsec } from '@/stores/Nsec'
  import { useFeed } from '@/stores/Feed'
  import { useRelay } from '@/stores/Relay'
  import Dropdown from '@/components/Dropdown.vue'

  const props = defineProps<{
    disabled: boolean
  }>()

  const emit = defineEmits(['showFeedNotice'])

  const nsecStore = useNsec()
  const feedStore = useFeed()
  const relayStore = useRelay()

  const feedSourceList = [
    { key: 'network', value: 'Network' },
    { key: 'follows', value: 'Follows' },
  ]

  const handleSelect = (value: string) => {
    if (!relayStore.isConnectedToRelay) {
      return emit(
        'showFeedNotice',
        'Please connect and login to load posts from people you follow.',
      )
    }
    if (!nsecStore.isValidNsecPresented() && value === 'follows') {
      return emit('showFeedNotice', 'Please login to load posts from people you follow.')
    }
    emit('showFeedNotice', '')
    feedStore.setSelectedFeedSource(value)
  }
</script>

<template>
  <Dropdown
    :disabled="props.disabled"
    :simpleStyling="true"
    :listItems="feedSourceList"
    :selectedKey="feedStore.selectedFeedSource"
    @handleSelect="handleSelect"
  />
</template>
