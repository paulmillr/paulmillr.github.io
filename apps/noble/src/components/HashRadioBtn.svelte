<script>
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
  export let hash;
  export let checked;
</script>

<span class="hash-radio">
  <input 
    type="radio"
    name="hash" 
    value="{hash}"
    id="{hash}"
    checked={checked}
    on:change={() => {
      dispatch('change', hash);
    }}
  />
  <label for="{hash}">{hash}</label>
</span>

<style>
  .hash-radio {
    display: block;
    margin-bottom: 5px;
  }

   @media (min-width: 480px) {
    .hash-radio {
      display: inline;
      margin-right: 10px;
      margin-bottom: 0;
    }
  }
</style>