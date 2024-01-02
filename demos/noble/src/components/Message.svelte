<script>
  import { message } from './../stores';
</script>

<div class="sign-message">
  <label for="sign-message-input">
    <strong>Message to sign</strong>
  </label>
  <div class="sign-message__input-container">
    <input
      class="text-input"
      id="sign-message-input"
      type="text"
      maxlength="512"
      bind:value={$message}
    />
  </div>
</div>

<style>
  .sign-message {
    margin-top: 10px;
    margin-bottom: 15px;
  }

  .sign-message__input-container {
    margin-top: 5px;
  }
</style>