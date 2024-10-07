<script setup lang="ts">
  import { onMounted, onUpdated, ref } from 'vue'

  const items = ref<HTMLDivElement | null>(null)
  const selectBtn = ref<HTMLDivElement | null>(null)
  const prevSelectedListItem = ref<HTMLLIElement | null>(null)

  const emit = defineEmits(['handleSelect'])
  const props = defineProps<{
    listItems: { key: string; value: string }[]
    simpleStyling?: boolean
    disabled?: boolean
    selectedKey?: string
  }>()

  const selectedIndex = ref(0)

  onUpdated(() => {
    updateSelectedIndex()
  })

  onMounted(() => {
    prevSelectedListItem.value = document.querySelector('.active')

    // collapse dropdown on blur
    document.addEventListener('click', (evt) => {
      // if (evt.target === select.value) return
      const target = evt.target as HTMLElement
      const { classList } = target
      if (
        classList.contains('item') ||
        classList.contains('select-button') ||
        classList.contains('items')
      ) {
        return
      }
      hideList()
    })

    // collapse dropdown on escape key
    document.addEventListener('keydown', (evt) => {
      if (evt.key === 'Escape') {
        hideList()
      }
    })

    updateSelectedIndex()
  })

  const updateSelectedIndex = () => {
    if (props.selectedKey) {
      const index = props.listItems.findIndex((item) => item.key === props.selectedKey)
      if (index !== -1) {
        selectedIndex.value = index
      }
    }
  }

  const handleSelectClick = () => {
    if (props.disabled) return
    if (!items.value) return
    items.value.classList.toggle('open')
  }

  const handleItemClick = (e: Event) => {
    if (!items.value || !selectBtn.value) return

    const target = e.target as HTMLLIElement
    if (!target.classList.contains('item')) return
    updateSelectedView(target)
    hideList()

    const selectedValue = target.dataset.value
    emit('handleSelect', selectedValue)
  }

  const updateSelectedView = (selectedListItem: HTMLLIElement) => {
    if (!selectBtn.value) return
    selectBtn.value.textContent = selectedListItem.textContent
    if (prevSelectedListItem.value) {
      prevSelectedListItem.value.classList.remove('active')
    }
    selectedListItem.classList.add('active')
    prevSelectedListItem.value = selectedListItem
  }

  const hideList = () => {
    if (!items.value) return
    items.value.classList.remove('open')
  }
</script>

<template>
  <div class="dropdown">
    <button
      ref="selectBtn"
      @click="handleSelectClick"
      :class="['select-button', { simple: simpleStyling, disabled: disabled }]"
    >
      {{ listItems[selectedIndex].value }}
    </button>
    <ul ref="items" class="items" @click="handleItemClick">
      <li
        v-for="(item, i) in listItems"
        :key="`item-${i}`"
        :data-value="item.key"
        :class="['item', { active: i === selectedIndex }]"
      >
        {{ item.value }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
  .dropdown {
    position: relative;
  }

  .dropdown * {
    box-sizing: border-box;
  }

  .select-button {
    width: 100%;
    border: none;
    background: #2a2f3b;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 7px 12px;
    border-radius: 5px;
    color: white;
    transition: background 0.2s;
    cursor: pointer;
    position: relative;
  }

  .select-button:hover {
    background: #323741;
  }

  .select-button.simple {
    background: none;
    padding: 0;
    border: none;
    color: inherit;
    display: inline-flex;
    padding-right: 15px;
  }

  .select-button.simple:hover {
    background: none;
  }

  .select-button::after {
    content: '';
    width: 6px;
    height: 6px;
    position: absolute;
    top: 50%;
    right: 10px;
    z-index: 1;
    border: solid white;
    border-width: 0 2px 2px 0;
    display: inline-block;
    transform: translateY(calc(-50% - 2px)) rotate(45deg);
    margin-bottom: 1px;
  }

  .select-button.simple::after {
    right: 0;
  }

  .select-button.disabled {
    cursor: default;
  }

  .items {
    position: absolute;
    min-width: 100%;
    list-style-type: none;
    padding: 7px 7px;
    background: #2a2f3b;
    border-radius: 5px;
    margin: 4px 0 0;
    transition: 0.2s;
    box-shadow: 0 0.5em 1em rgba(0, 0, 0, 0.2);
    opacity: 0;
    display: none;
    z-index: 1;
  }

  .items li {
    padding: 3px 10px;
    margin: 3px 0;
    border-radius: 5px;
    cursor: pointer;
  }

  .items li:hover {
    background: #323741;
  }

  .items li.active {
    background: #0092bf;
  }

  .items.open {
    opacity: 1;
    display: block;
  }
</style>
