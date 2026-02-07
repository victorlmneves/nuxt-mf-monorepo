<template>
    <nav class="host-menu">
        <header class="menu-header">
            <h2>Host</h2>
        </header>
        <ul class="menu-list">
            <li><NuxtLink to="/" class="nav-link">Home</NuxtLink></li>
            <li><NuxtLink to="/remote-example?scope=checkout" class="nav-link">Checkout</NuxtLink></li>
            <li><NuxtLink to="/remote-example?scope=profile" class="nav-link">Profile</NuxtLink></li>
            <li><NuxtLink to="/remote-example?scope=admin" class="nav-link">Admin</NuxtLink></li>
        </ul>
    </nav>
</template>

<style scoped>
.host-menu {
    width: 220px;
    padding: 1rem;
    border-right: 1px solid #e5e7eb;
    background: #fafafa;
    min-height: 100vh;
    box-sizing: border-box;
}
.menu-header {
    margin-bottom: 0.5rem;
}
.menu-list {
    list-style: none;
    padding: 0;
    margin: 0;
}
.menu-list li {
    margin: 0.35rem 0;
}
.nav-link {
    color: #111827;
    text-decoration: none;
}
.nav-link.router-link-active {
    font-weight: 600;
}
</style>
