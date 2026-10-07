/*
 * Gestión de cuenta en servidores Windows Pre-productivo — 2 correcciones de la revisión
 * 1) "Ambiente / Hostname / Dirección IP" hoy es Texto (6) obligatorio con ayuda "Indique servidor(es)…";
 *    en Remedy es una etiqueta de texto enriquecido bajo "Indique servidor(es) que requiere acceso".
 *    → se inactiva la variable antigua (no se borra) y se crea la etiqueta
 *      u_gest_cta_srv_win_pprod_amb_hostname_dir_ip_texto (tipo 32) en el mismo orden.
 * 2) Descripción: el link al adjunto "Informe Solicitud de Ambiente - Base.docx" (ya adjunto al ítem)
 *    se pone también en la descripción base (hoy solo lo tiene la traducción es) y ambos quedan con /sys_attachment.do.
 * Cuenta: ADMIN | DRY_RUN=true solo lectura | DRY_RUN=false MODIFICA DATOS
 * (scope Global, update set seleccionado, "Record for rollback?" marcado)
 */
var DRY_RUN = true;
var ITEM_ID = '716b40cf1b5ffad058f65425604bcb17';
var P = 'u_gest_cta_srv_win_pprod_';
var OLD = P + 'amb_hostname_dir_ip';
var NEW = P + 'amb_hostname_dir_ip_texto';
var RICH = '<p>Ambiente / Hostname / Dirección IP</p>';
var ARCHIVO = 'Informe Solicitud de Ambiente - Base.docx';
var TEXTO_LINK = 'Informe Solicitud de Ambiente.docx';

gs.print('DRY_RUN = ' + DRY_RUN);

// 1) Etiqueta
gs.print('\n1) Ambiente / Hostname / Dirección IP');
var o = new GlideRecord('item_option_new'); o.addQuery('cat_item', ITEM_ID); o.addQuery('name', OLD); o.query();
if (!o.next()) gs.print('❌ No existe ' + OLD);
else {
    var cnt = new GlideAggregate('sc_item_option_mtom');
    cnt.addQuery('sc_item_option.item_option_new', o.getUniqueValue()); cnt.addNotNullQuery('sc_item_option.value'); cnt.addAggregate('COUNT'); cnt.query();
    gs.print('   ' + OLD + ' | ' + o.getDisplayValue('type') + ' | activa=' + o.getValue('active') + ' → inactivar | RITM con valor: ' + (cnt.next() ? cnt.getAggregate('COUNT') : 0) + ' (siguen viéndolo)');
    if (!DRY_RUN && o.getValue('active') == '1') { o.setValue('active', false); o.update(); }

    var n = new GlideRecord('item_option_new'); n.addQuery('cat_item', ITEM_ID); n.addQuery('name', NEW); n.query();
    if (n.next()) gs.print('   ' + NEW + ' ya existe (' + n.getUniqueValue() + ')');
    else {
        gs.print('   crear ' + NEW + ' | Etiqueta de texto enriquecido (32) | orden ' + o.getValue('order') + ' | ' + RICH);
        if (!DRY_RUN) {
            n.initialize();
            n.setValue('cat_item', ITEM_ID); n.setValue('name', NEW); n.setValue('type', 32);
            n.setValue('question_text', 'Ambiente / Hostname / Dirección IP');
            n.setValue('rich_text', RICH); n.setValue('order', o.getValue('order')); n.setValue('active', true);
            gs.print('   sys_id: ' + n.insert());
        }
    }
}

// 2) Descripción
gs.print('\n2) Descripción');
var att = new GlideRecord('sys_attachment');
att.addQuery('table_name', 'sc_cat_item'); att.addQuery('table_sys_id', ITEM_ID); att.addQuery('file_name', ARCHIVO); att.query();
if (!att.next()) gs.print('❌ No encontré el adjunto "' + ARCHIVO + '" en el ítem');
else {
    var href = '/sys_attachment.do?sys_id=' + att.getUniqueValue();
    var link = '<a href="' + href + '" target="_blank" rel="noopener noreferrer"><strong>' + TEXTO_LINK + '</strong></a>';
    var arreglar = function (html) {
        if (html.indexOf(att.getUniqueValue()) > -1) return html.replace(/href="sys_attachment\.do/g, 'href="/sys_attachment.do');
        return html.replace(TEXTO_LINK, link);
    };
    var it = new GlideRecord('sc_cat_item'); it.get(ITEM_ID);
    var d = it.getValue('description') || '', d2 = arreglar(d);
    if (d2 == d) gs.print('   base: sin cambio' + (d.indexOf(TEXTO_LINK) == -1 ? ' (no contiene "' + TEXTO_LINK + '", revisar)' : ''));
    else { gs.print('   base →\n' + d2); if (!DRY_RUN) { it.setValue('description', d2); it.update(); } }

    var tr = new GlideRecord('sys_translated_text');
    tr.addQuery('tablename', 'sc_cat_item'); tr.addQuery('documentkey', ITEM_ID); tr.addQuery('fieldname', 'description'); tr.addQuery('language', 'es'); tr.query();
    if (!tr.next()) gs.print('   es: sin traducción');
    else {
        var e = tr.getValue('value') || '', e2 = arreglar(e);
        if (e2 == e) gs.print('   es: sin cambio');
        else { gs.print('   es →\n' + e2); if (!DRY_RUN) { tr.setValue('value', e2); tr.update(); } }
    }
}
gs.print('\nFIN' + (DRY_RUN ? ' (DRY RUN, nada modificado)' : ' (cambios aplicados)'));
