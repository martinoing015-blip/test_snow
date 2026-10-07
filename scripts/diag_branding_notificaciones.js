/*
 * Diagnóstico de branding de notificaciones (para la reunión "Problemas: Branding Notificaciones").
 * Muestra: layouts y templates de correo, qué notificaciones activas usan cada uno,
 * cuáles salen SIN branding, imágenes (logo) de cada layout/template y propiedades de correo.
 * Cuenta: ADMIN | SOLO LECTURA (no modifica nada)
 */
var SOLO_TABLA = '';   // opcional: ej. 'sc_req_item' para ver solo notificaciones de RITM

function campo(g, f) { return g.isValidField(f) ? (g.getValue(f) || '') : ''; }
function imagenes(html) {
    var out = [], re = /<img[^>]+src\s*=\s*["']([^"']+)["']/gi, m;
    while ((m = re.exec(html || '')) !== null) out.push(m[1]);
    return out;
}
function revisarImagenes(html, pref) {
    imagenes(html).forEach(function (src) {
        var tipo = /^https?:\/\//i.test(src) && src.indexOf('service-now.com') == -1 ? 'URL externa'
            : (/sys_attachment\.do|\.iix|\.png|\.jpg|\.gif|\.svg/i.test(src) ? 'imagen de la instancia' : 'otro');
        var aviso = /^data:/i.test(src) ? ' ⚠️ base64 (Outlook suele bloquearla)'
            : (/^\//.test(src) || /^[a-z0-9_]+\.(iix|png|jpg|gif|svg)/i.test(src) ? ' ⚠️ ruta relativa (fuera de la instancia no carga)' : '');
        gs.print(pref + '🖼️ ' + src + ' [' + tipo + ']' + aviso);
    });
}

// 1) Layouts
gs.print('=== 1) Email Layouts (sys_email_layout)');
var layouts = {};
var lay = new GlideRecord('sys_email_layout');
if (!lay.isValid()) gs.print('(tabla no existe en esta versión)');
else {
    lay.orderBy('name'); lay.query();
    while (lay.next()) {
        layouts[lay.getUniqueValue()] = lay.getValue('name');
        var html = campo(lay, 'layout');
        gs.print('- ' + lay.getValue('name') + ' [' + lay.getUniqueValue() + '] | actualizado ' + lay.getValue('sys_updated_on') + ' por ' + lay.getValue('sys_updated_by')
            + (html.indexOf('${notification:body}') == -1 ? ' ⚠️ sin ${notification:body} (el texto de la notificación no aparece)' : ''));
        revisarImagenes(html, '    ');
    }
}

// 2) Templates
gs.print('\n=== 2) Email Templates (sysevent_email_template)');
var templates = {};
var tp = new GlideRecord('sysevent_email_template');
if (SOLO_TABLA) tp.addQuery('collection', SOLO_TABLA);
tp.orderBy('name'); tp.query();
while (tp.next()) {
    var lid = campo(tp, 'email_layout');
    templates[tp.getUniqueValue()] = { name: tp.getValue('name'), layout: lid };
    gs.print('- ' + tp.getValue('name') + ' | tabla ' + campo(tp, 'collection') + ' | layout: ' + (lid ? (layouts[lid] || lid) : '(ninguno)')
        + ' | actualizado ' + tp.getValue('sys_updated_on') + ' por ' + tp.getValue('sys_updated_by'));
    revisarImagenes(campo(tp, 'message_html'), '    ');
}

// 3) Notificaciones activas: con qué branding salen
gs.print('\n=== 3) Notificaciones activas (sysevent_email_action)');
var cuenta = {}, sinBranding = [];
var n = new GlideRecord('sysevent_email_action');
n.addActiveQuery();
if (SOLO_TABLA) n.addQuery('collection', SOLO_TABLA);
n.orderBy('collection'); n.orderBy('name'); n.query();
while (n.next()) {
    var tid = campo(n, 'template'), nlid = campo(n, 'email_layout');
    var layoutEfectivo = nlid || (tid && templates[tid] ? templates[tid].layout : '');
    var desc = (tid ? 'template "' + (templates[tid] ? templates[tid].name : tid) + '"' : 'sin template')
        + ' | layout: ' + (layoutEfectivo ? (layouts[layoutEfectivo] || layoutEfectivo) : '(ninguno)');
    var clave = layoutEfectivo ? (layouts[layoutEfectivo] || layoutEfectivo) : '(sin layout)';
    cuenta[clave] = (cuenta[clave] || 0) + 1;
    if (!layoutEfectivo) sinBranding.push(n.getValue('name') + ' [' + campo(n, 'collection') + ']');
    gs.print('- ' + n.getValue('name') + ' | ' + campo(n, 'collection') + ' | ' + desc);
    revisarImagenes(campo(n, 'message_html'), '    ');
}
gs.print('\nResumen por layout:');
for (var k in cuenta) gs.print('  ' + k + ': ' + cuenta[k]);
gs.print('Notificaciones activas sin layout (salen sin branding): ' + sinBranding.length);
sinBranding.forEach(function (s) { gs.print('  ⚠️ ' + s); });

// 4) Propiedades de correo que afectan cómo se ve / desde dónde sale
gs.print('\n=== 4) Propiedades de correo');
var p = new GlideRecord('sys_properties');
var qp = p.addQuery('name', 'IN', 'glide.servlet.uri,glide.email.smtp.active,glide.email.default.sender,glide.email.username,instance_name');
qp.addOrCondition('name', 'CONTAINS', 'brand');
qp.addOrCondition('name', 'CONTAINS', 'email.layout');
p.orderBy('name'); p.query();
while (p.next()) gs.print('- ' + p.getValue('name') + ' = ' + p.getValue('value'));

// 5) Últimos correos enviados: para comparar con lo que reclaman
gs.print('\n=== 5) Últimos 10 correos enviados');
var e = new GlideRecord('sys_email');
e.addQuery('type', 'sent');
if (SOLO_TABLA) e.addQuery('target_table', SOLO_TABLA);
e.orderByDesc('sys_created_on'); e.setLimit(10); e.query();
while (e.next()) gs.print('- ' + e.getValue('sys_created_on') + ' | ' + e.getValue('subject') + ' | ' + e.getValue('target_table') + ' [sys_email ' + e.getUniqueValue() + ']');
