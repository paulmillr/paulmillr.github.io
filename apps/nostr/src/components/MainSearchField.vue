<script setup lang="ts">
  import { ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { useNpub } from '@/stores/Npub'
  import { useUser } from '@/stores/User'
  import { isSHA256Hex, getNip19FromSearch } from '@/utils/utils'

  const npubStore = useNpub()
  const userStore = useUser()
  const router = useRouter()

  const isFocused = ref(false)
  const errorTimeout = ref(0)
  const input = ref(<HTMLInputElement>{})

  const handleInputNpub = () => {
    clearTimeout(errorTimeout.value)

    const query = npubStore.npubInput
    if (!query.length) {
      npubStore.setError('')
      return
    }

    let searchType = 'user'
    if (!isSHA256Hex(query)) {
      try {
        const { type } = getNip19FromSearch(query)
        if (type === 'note') {
          searchType = 'event'
        }
      } catch (e: any) {
        // if we already have a full wrong pubkey or nip19 note/npub we show error immediately
        // otherwise we wait for 2 seconds to show an error to give the user a chance to finish typing
        if (query.length > 62) {
          npubStore.setError(e.message)
        } else {
          errorTimeout.value = setTimeout(() => {
            npubStore.setError(e.message)
          }, 2000) as unknown as number
        }
        return
      }
    }
    npubStore.setError('')

    routeToUser(query, searchType)
  }

  const handleInputFocus = () => {
    isFocused.value = true
    const query = npubStore.npubInput
    if (!query.length) {
      npubStore.setError('')
      return
    }

    let searchType = 'user'
    if (isSHA256Hex(query)) {
      routeToUser(query, searchType)
    } else {
      try {
        const { type } = getNip19FromSearch(query)
        if (type === 'note') {
          searchType = 'event'
        }
        routeToUser(query, searchType)
      } catch (e) {
        // input focused, but no valid value is presented, so we don't route to user
      }
    }
  }

  const routeToUser = (query: string, type: string) => {
    userStore.updateSearchStatus(true)
    userStore.updateRoutingStatus(true)
    router.push({ path: `/${type}/${query}` })
  }

  const clearInput = () => {
    clearTimeout(errorTimeout.value)
    npubStore.updateNpubInput('')
    npubStore.setError('')
    input.value.focus()
  }
</script>

<template>
  <div class="search">
    <div
      :class="['search-field', { active: isFocused, 'has-content': npubStore.npubInput.length }]"
    >
      <i @click="input.focus()" class="bi bi-search search-icon"></i>
      <input
        @focus="handleInputFocus"
        @blur="isFocused = false"
        :class="['search-input', { active: isFocused }]"
        type="text"
        placeholder="pubkey or note id..."
        v-model.trim="npubStore.npubInput"
        @input="handleInputNpub"
        ref="input"
      />
      <i
        @click="clearInput"
        v-if="npubStore.npubInput.length"
        class="bi bi-x-circle clear-icon"
      ></i>
    </div>
    <div v-if="npubStore.error.length" class="warning">* {{ npubStore.error }}</div>
  </div>
</template>

<style scoped>
  .search {
    width: 100%;
    margin-top: 10px;
    margin-bottom: 15px;
    text-align: right;
  }

  .search-field {
    display: inline-block;
    width: 100%;
    position: relative;
  }

  @media (min-width: 485px) {
    .search-field {
      width: 50%;
    }
  }

  @media (min-width: 640px) {
    .search-field {
      width: 30%;
    }
  }

  .search-field.active,
  .search-field.has-content {
    display: block;
    width: 100%;
  }

  .search-icon {
    position: absolute;
    top: 50%;
    left: 10px;
    transform: translateY(-50%);
    color: #2a2f3b;
  }

  .clear-icon {
    position: absolute;
    top: 50%;
    right: 10px;
    transform: translateY(-50%);
    color: #0092bf;
    cursor: pointer;
  }

  .search-input {
    background: transparent;
    color: inherit;
    border: 1px solid #2a2f3b;
    outline: none;
    border-radius: 5px;
    padding: 6px 12px 6px 35px;
    box-sizing: border-box;
    width: 100%;
    font-size: 16px;
    /* transition: width 0.2s; */
  }

  .search-input:focus {
    border: 1px solid #0092bf;
  }

  .warning {
    text-align: left;
    color: #ffda6a;
    font-size: 16px;
    margin-top: 2px;
  }
</style>
