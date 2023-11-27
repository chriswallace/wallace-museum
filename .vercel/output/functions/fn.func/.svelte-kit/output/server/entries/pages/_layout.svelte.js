import { c as create_ssr_component, v as validate_component } from "../../chunks/ssr.js";
const Header_svelte_svelte_type_style_lang = "";
const css$1 = {
  code: "header.svelte-unhs0j.svelte-unhs0j{margin-bottom:2rem;border-width:0px;border-bottom-width:2px;border-style:solid;--tw-border-opacity:1;border-color:rgb(0 0 0 / var(--tw-border-opacity));padding-top:1.5rem;padding-bottom:1.5rem;padding-left:2rem;padding-right:2rem;font-size:1.125rem;line-height:1.75rem\n}header.svelte-unhs0j a.svelte-unhs0j{font-size:0.75rem;line-height:1rem;font-weight:700;text-transform:uppercase;--tw-text-opacity:1;color:rgb(255 255 255 / var(--tw-text-opacity));text-decoration-line:none\n}@media(min-width: 768px){header.svelte-unhs0j a.svelte-unhs0j{font-size:1rem;line-height:1.5rem\n  }}@media(prefers-color-scheme: dark){header.svelte-unhs0j.svelte-unhs0j{--tw-border-opacity:1;border-color:rgb(97 97 97 / var(--tw-border-opacity))\n  }}",
  map: null
};
const Header = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  $$result.css.add(css$1);
  return `<header class="svelte-unhs0j" data-svelte-h="svelte-xl6t8a"><nav aria-label="Global"><a href="/" class="svelte-unhs0j"><span>Wallace Collection</span></a></nav> </header>`;
});
const _layout_svelte_svelte_type_style_lang = "";
const css = {
  code: "body{margin:0px;padding:0px;font-family:Helvetica, Arial, sans-serif;font-size:0.85em;background-color:#aaa;color:#555555}a{color:rgb(39, 165, 45)}@media(prefers-color-scheme: dark){body{background-color:#101010;color:#dfdfdf}a{color:rgb(38, 213, 47)}}",
  map: null
};
const Layout = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  $$result.css.add(css);
  return `${validate_component(Header, "Header").$$render($$result, {}, {}, {})} <main>${slots.default ? slots.default({}) : ``} </main>`;
});
export {
  Layout as default
};
