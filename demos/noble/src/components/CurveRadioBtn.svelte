<script>
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
  export let name;
  export let value;
  export let title;
  export let checked = false;
</script>

<div class="ecc-radio">
  <input 
    type="radio"
    name={name}
    value={value}
    id={value}
    checked={checked}
    on:change={() => {
      dispatch('change', value);
    }}
  />
  <label for={value}>
    {title}
  </label>
</div>