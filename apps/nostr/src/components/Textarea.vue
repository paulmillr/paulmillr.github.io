<script setup lang="ts">
  import { ref } from 'vue'

  const props = defineProps<{
    rows: number
    placeholder: string
    disabled?: boolean
    name?: string
    isJson?: boolean
    noBorder?: boolean
  }>()

  const emit = defineEmits(['input', 'focus', 'blur'])

  const text = ref('')
  const _rows = ref(props.rows)

  const handleInput = () => {
    emit('input', text.value)
    let lines = text.value.split('\n').length
    if (lines < 3) lines = 3
    _rows.value = lines
  }

  const handleFocus = () => {
    emit('focus')
  }

  const handleBlur = () => {
    emit('blur')
  }
</script>

<template>
  <textarea
    :name="name"
    :disabled="disabled"
    :rows="_rows"
    :placeholder="placeholder"
    v-model="text"
    @input="handleInput"
    @focus="handleFocus"
    @blur="handleBlur"
    :class="[{ json: isJson, 'no-border': noBorder }]"
  ></textarea>
</template>

<style scoped>
  textarea {
    font-size: 18px;
    padding: 10px 12px;
    width: 100%;
    box-sizing: border-box;
    background: transparent;
    color: inherit;
    outline: none;
    line-height: 1.3;
    resize: none;
    display: block;
    border: 1px solid #2a2f3b;
    border-radius: 5px;
  }

  textarea.no-border {
    border: none;
  }

  textarea.json {
    font-size: 15px;
    font-family: monospace;
  }

  textarea:focus {
    border: 1px solid #0092bf;
  }

  textarea.no-border:focus {
    border: none;
  }
</style>
