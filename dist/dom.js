// Element lookup and a tiny element builder.
export function $(id) {
    const el = document.getElementById(id);
    if (!el)
        throw new Error(`#${id} missing`);
    return el;
}
export function h(tag, props = {}, ...children) {
    const el = document.createElement(tag);
    const { class: cls, ...rest } = props;
    if (cls)
        el.className = cls;
    Object.assign(el, rest);
    el.append(...children);
    return el;
}
