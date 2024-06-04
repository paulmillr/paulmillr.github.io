<script setup lang="ts">
  import { defineEmits, watch } from 'vue'
  import { useRoute } from 'vue-router'
  
  defineProps<{
    pagesCount: number
    currentPage: number
  }>()

  const emit = defineEmits(['showPage'])

  const route = useRoute()

  const paginate = (page: number) => {
    return {
      path: route.path,
      query: {
        ...route.query,
        page: page,
      }
    }
  }

  watch(
    () => route.query.page,
    async (page) => {
      const p = parseInt(page as string)
      if (p) emit('showPage', p)
    },
  )
</script>

<template>
  <div v-if="pagesCount > 1" class="pagination">
    Pages: 
    <span v-if="pagesCount < 5">
      <router-link :key="page" :class="['pagination__link', { 'pagination__link_active': currentPage == page }]" v-for="page in pagesCount" :to="paginate(page)">
        {{ page }}
      </router-link>
    </span>
    <span v-if="pagesCount >= 5">
      <router-link v-if="currentPage >= 3" :key="1" :class="['pagination__link']" :to="paginate(1)">
        {{ 1 }}
      </router-link>

      <span v-if="currentPage > 3">...</span>

      <router-link v-if="currentPage != 1" :key="currentPage - 1" :class="['pagination__link']" :to="paginate(currentPage - 1)">
        {{ currentPage - 1 }}
      </router-link>

      <router-link :key="currentPage" :class="['pagination__link pagination__link_active']" :to="paginate(currentPage)">
        {{ currentPage }}
      </router-link>
      <router-link v-if="currentPage != pagesCount" :key="currentPage + 1" :class="['pagination__link']" :to="paginate(currentPage + 1)">
        {{ currentPage + 1 }}
      </router-link>

      <span v-if="currentPage < (pagesCount - 2)">...</span>

      <router-link v-if="currentPage <= (pagesCount - 2)" :key="pagesCount" :class="['pagination__link']" :to="paginate(pagesCount)">
        {{ pagesCount }}
      </router-link>
    </span>
  </div>
</template>

<style scoped>
  .pagination__link {
    margin-left: 5px;
  }

  .pagination__link_active {
    color:#3aa99f;
  }
</style>