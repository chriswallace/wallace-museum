<script>
    export let items = []; // items to display and edit, e.g., collections or artists
    export let onSave; // optional callback function to handle saving changes

    let editableIndex = null; // track which item is currently being edited

    // Function to handle saving edits
    function saveEdit(item, index) {
        // Here you could also call an external save function, passing the modified item
        if (typeof onSave === 'function') {
            onSave(item, index);
        }
        editableIndex = null; // Reset editable index to hide inputs
    }

    // Function to cancel the edit and reset the editable index
    function cancelEdit() {
        editableIndex = null; // Reset editable index to hide inputs
    }
</script>

<table>
    <thead>
        <tr>
            <th>Title</th>
            <th>Description</th>
            <th>Actions</th>
        </tr>
    </thead>
    <tbody>
        {#each items as item, index}
            <tr>
                <td>
                    {#if editableIndex === index}
                        <input type="text" bind:value={item.name} />
                    {:else}
                        <div class="input">{item.name}</div>
                    {/if}
                </td>
                <td>
                    {#if editableIndex === index}
                        <textarea bind:value={item.description}></textarea>
                    {:else}
                        <div class="textarea">{item.description}</div>
                    {/if}
                </td>
                <td>
                    {#if editableIndex === index}
                        <button class="primary ghost" on:click={() => saveEdit(item, index)}>Save</button>
                        <button class="cta delete" on:click={cancelEdit}>Cancel</button>
                    {:else}
                        <button class="primary ghost" on:click={() => editableIndex = index}>Edit</button>
                    {/if}
                </td>
            </tr>
        {/each}
    </tbody>
</table>

<style>
    table {
        width: 100%;
    }
    th, td {
        border: 1px solid #ddd;
        text-align: left;
    }
    th {
        border-right: 1px solid #ddd;
    }
    input, textarea {
        width: 100%;
        padding: 6px;
        margin: 4px 0;
        box-sizing: border-box;
        border: 2px solid #aaa;
    }
    .textarea{
        width: 100%;
    }
    button {
        margin-right: 4px;
    }
</style>