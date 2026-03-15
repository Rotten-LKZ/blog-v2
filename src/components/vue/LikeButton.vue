<template>
	<button class="like-btn" :class="{ liked }" @click="toggle">
		<span class="heart">{{ liked ? '&#10084;' : '&#9825;' }}</span>
		<span class="like-text">{{ liked ? 'Liked!' : 'Like' }}</span>
		<span v-if="count > 0" class="like-count">{{ count }}</span>
	</button>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const liked = ref(false);
const count = ref(0);

function toggle() {
	liked.value = !liked.value;
	count.value += liked.value ? 1 : -1;
}
</script>

<style scoped>
.like-btn {
	display: inline-flex;
	align-items: center;
	gap: 0.4rem;
	padding: 0.5rem 1.2rem;
	border: 2px solid var(--color-accent);
	border-radius: 999px;
	background: var(--color-bg-card);
	color: var(--color-accent);
	font-size: 0.95em;
	font-weight: 600;
	cursor: pointer;
	transition: all 0.3s ease;
	font-family: inherit;
}

.like-btn:hover {
	background: var(--color-primary-pale);
}

.like-btn.liked {
	background: var(--color-accent);
	color: white;
	border-color: var(--color-accent);
}

.heart {
	font-size: 1.2em;
	transition: transform 0.3s ease;
}

.like-btn.liked .heart {
	animation: heartPop 0.4s ease;
}

.like-count {
	background: rgba(255, 255, 255, 0.3);
	padding: 0 0.4em;
	border-radius: 999px;
	font-size: 0.85em;
}

@keyframes heartPop {
	0% { transform: scale(1); }
	50% { transform: scale(1.4); }
	100% { transform: scale(1); }
}
</style>
