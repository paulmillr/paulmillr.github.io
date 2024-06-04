<script>
  import { createEventDispatcher } from 'svelte';
  import { isBigInt } from './../lib/utils';

  const dispatch = createEventDispatcher();

  export let field; // ex. a_x
  export let value;
  export let label;

  let error = '';

  const handleInput = (e) => {
    const { value } = e.target;
    if (value === '-') return; // allow negative sign
    if (!isBigInt(value)) {
      error = `${label} should be non floating point integer`;
      return;
    }
    error = '';
    dispatch('input', { value, field });
  };
</script>

<div class="point-input">
  <label class="point-input__label" for={field}>
    <strong>{label}</strong>
  </label>
  <input
    class='text-input'
    id={field}
    type="text"
    value={value}
    on:input={handleInput}
  />
</div>
{#if error.length}
  <div class="error">{error}</div>
{/if}

<style>
  .point-input {
    display: flex;
    margin-bottom: 10px;
  }

  .point-input__label {
    margin-right: 10px;
  }

  .error {
    color: red;
    font-weight: bold;
    font-size: 16px;
    margin-top: -5px;
    margin-bottom: 10px;
    margin-left: 22px;
  }
</style>