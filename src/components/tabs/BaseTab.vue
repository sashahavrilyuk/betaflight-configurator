<template>
    <div :class="`tab-${tabName}`">
        <slot />
    </div>
</template>

<script>
export default {
    name: 'BaseTab',
    props: {
        tabName: {
            type: String,
            required: true,
        },
    },
};
</script>
