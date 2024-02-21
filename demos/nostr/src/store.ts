import { reactive } from 'vue'

export const gettingUserInfoId = reactive({
  value: 1,
  update(value: number) {
    this.value = value
  }
})