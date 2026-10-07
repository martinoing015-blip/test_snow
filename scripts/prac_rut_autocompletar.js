/*
 * Practicantes (a6837d761b5736d0d4f1a756624bcb09) — planilla "Manejo de RUT":
 *   "Elegir Nombre completo desde lista desplegable, que mapee RUT, nombre, apellidos y username,
 *    pero que no muestre al usuario solicitante el RUT (información guardada por detrás)"
 * Hoy el portal ya autollena Rut / Nombres / Apellidos con el Auto-populate de las variables (dependen del usuario elegido).
 * 1) Muestra la configuración Auto-populate de Rut / Nombres / Apellidos.
 * 2) Variable nueva USERNAME (ID usuario de dominio, solo lectura) después de Apellidos, con el MISMO Auto-populate que Nombres
 *    pero apuntando a user_name. Sin client script ni Script Include.
 * 3) UI Policy "Ocultar RUT en portal" (solo catálogo): el solicitante no ve el RUT; se guarda igual y se ve en RITM / tarea.
 * 4) Textos (ARREGLAR_TEXTOS): "Nombres del", "Apellidos del", " Seleccione aplicativo…" sin espacio inicial. Actualiza también la traducción es*.
 * 5) (opcional) etiqueta del usuario → "Nombre completo del Solicitante" si CAMBIAR_ETIQUETA_USUARIO = true.
 * No toca values ni el Flow.
 * Cuenta: ADMIN | DRY_RUN=true solo lectura | DRY_RUN=false MODIFICA
 * (scope Global, update set seleccionado, "Record for rollback?" marcado)
 */
var DRY_RUN = true;
var ITEM_ID = 'a6837d761b5736d0d4f1a756624bcb09';
var USERNAME = { name: 'u_prac_username_solicitante', label: 'Usuario de Dominio del Solicitante' };
var ARREGLAR_TEXTOS = true;
var CAMBIAR_ETIQUETA_USUARIO = false;
var ETIQUETA_USUARIO = 'Nombre completo del Solicitante';

function v(name) { var g = new GlideRecord('item_option_new'); g.addQuery('cat_item', ITEM_ID); g.addQuery('name', name); g.query(); return g.next() ? g : null; }
function autoPop(gr) {   // campos de Auto-populate con valor (dynamic_value_field, dynamic_value_dot_walk_path, …)
    var r = {}, els = gr.getElements();
    for (var i = 0; i < els.size(); i++) {
        var n = '' + els.get(i).getName();
        if (/dynamic|auto_?pop|dependent/i.test(n) && gr.getValue(n)) r[n] = gr.getValue(n);
    }
    return r;
}
function verAuto(gr) { var a = autoPop(gr), s = []; for (var k in a) s.push(k + '=' + a[k]); return s.join(' | ') || '(sin Auto-populate)'; }
function setTexto(gr, nuevo) {
    var actual = gr.getValue('question_text'), trs = [];
    var t = new GlideRecord('sys_translated_text');
    t.addQuery('tablename', 'item_option_new'); t.addQuery('documentkey', gr.getUniqueValue()); t.addQuery('fieldname', 'question_text'); t.addQuery('language', 'STARTSWITH', 'es'); t.query();
    while (t.next()) if (t.getValue('value') != nuevo) trs.push({ id: t.getUniqueValue(), lang: t.getValue('language'), val: t.getValue('value') });
    if (actual == nuevo && !trs.length) { gs.print('   = ' + gr.getValue('name') + ': "' + nuevo + '" (ya está)'); return; }
    gs.print('   • ' + gr.getValue('name') + ': "' + actual + '" → "' + nuevo + '"' + trs.map(function (x) { return ' | traducción ' + x.lang + ': "' + x.val + '"'; }).join(''));
    if (DRY_RUN) return;
    if (actual != nuevo) { gr.setValue('question_text', nuevo); gr.update(); }
    trs.forEach(function (x) { var u = new GlideRecord('sys_translated_text'); if (u.get(x.id)) { u.setValue('value', nuevo); u.update(); } });
}

gs.print('DRY_RUN = ' + DRY_RUN);
var item = new GlideRecord('sc_cat_item');
if (!item.get(ITEM_ID)) gs.print('❌ No existe el ítem');
else {
    gs.print('=== ' + item.getValue('name'));
    var USUARIO = v('u_prac_usuario_dominio_solicitante'), RUT = v('u_prac_rut_solicitante'), NOM = v('u_prac_nombres_solicitante'), APE = v('u_prac_apellidos_solicitante');
    if (!USUARIO || !RUT || !NOM || !APE) gs.print('❌ Faltan variables del solicitante; no se hace nada');
    else {
        // 1) Auto-populate actual
        gs.print('\n1) Auto-populate actual');
        gs.print('   Rut:       ' + verAuto(RUT));
        gs.print('   Nombres:   ' + verAuto(NOM));
        gs.print('   Apellidos: ' + verAuto(APE));

        // 2) Variable username
        gs.print('\n2) Variable ' + USERNAME.name + ' "' + USERNAME.label + '"');
        var base = autoPop(NOM), campoPath = '';
        for (var k in base) if (/dot_walk|path/i.test(k)) campoPath = k;
        var U = v(USERNAME.name);
        if (U) gs.print('   ya existe (' + U.getUniqueValue() + ') | ' + verAuto(U));
        else if (!campoPath) gs.print('   ⚠️ Nombres no tiene Auto-populate con ruta (dot walk): no se crea; mándame el output');
        else {
            var ord = parseInt(APE.getValue('order'), 10) + 5;
            gs.print('   crear | texto una línea | solo lectura | orden ' + ord + ' | Auto-populate igual que Nombres con ' + campoPath + '=user_name');
            if (!DRY_RUN) {
                var n = new GlideRecord('item_option_new'); n.initialize();
                n.setValue('cat_item', ITEM_ID); n.setValue('name', USERNAME.name); n.setValue('question_text', USERNAME.label);
                n.setValue('type', 6); n.setValue('order', ord); n.setValue('read_only', true); n.setValue('active', true);
                for (var c in base) n.setValue(c, base[c]);
                n.setValue(campoPath, 'user_name');
                var nid = n.insert();
                var chk = new GlideRecord('item_option_new'); chk.get(nid);
                gs.print('   sys_id: ' + nid + ' | ' + verAuto(chk));
            }
        }

        // 3) Ocultar RUT en el portal
        gs.print('\n3) UI Policy "Ocultar RUT en portal" (solo catálogo; en RITM / tarea se sigue viendo)');
        var p = new GlideRecord('catalog_ui_policy'); p.addQuery('catalog_item', ITEM_ID); p.addQuery('short_description', 'Ocultar RUT en portal'); p.query();
        var pid = p.next() ? p.getUniqueValue() : '';
        gs.print('   ' + (pid ? 'ya existe (' + pid + ')' : 'crear policy + acción RUT visible=false'));
        if (!DRY_RUN && !pid) {
            p.initialize(); p.setValue('catalog_item', ITEM_ID); p.setValue('short_description', 'Ocultar RUT en portal');
            p.setValue('catalog_conditions', ''); p.setValue('on_load', true); p.setValue('reverse_if_false', true); p.setValue('order', 50);
            p.setValue('applies_catalog', true); p.setValue('applies_req_item', false); p.setValue('applies_sc_task', false); p.setValue('active', true);
            pid = p.insert();
            var a = new GlideRecord('catalog_ui_policy_action'); a.initialize();
            a.setValue('ui_policy', pid); a.setValue('catalog_item', ITEM_ID); a.setValue('catalog_variable', 'IO:' + RUT.getUniqueValue());
            a.setValue('visible', 'false'); a.setValue('mandatory', 'ignore'); a.setValue('disabled', 'ignore');
            a.insert();
            gs.print('   sys_id: ' + pid);
        }

        // 4) Textos
        gs.print('\n4) Textos' + (ARREGLAR_TEXTOS ? '' : ' (ARREGLAR_TEXTOS = false, se omite)'));
        if (ARREGLAR_TEXTOS) {
            setTexto(NOM, 'Nombres del Solicitante');
            setTexto(APE, 'Apellidos del Solicitante');
            var app = v('u_prac_sel_app_acc'); if (app) setTexto(app, 'Seleccione aplicativo que requiere acceso');
        }

        // 5) Etiqueta del usuario
        gs.print('\n5) Etiqueta del usuario' + (CAMBIAR_ETIQUETA_USUARIO ? '' : ' (CAMBIAR_ETIQUETA_USUARIO = false, se deja "' + USUARIO.getValue('question_text') + '")'));
        if (CAMBIAR_ETIQUETA_USUARIO) setTexto(USUARIO, ETIQUETA_USUARIO);
    }
}
gs.print('\nFIN' + (DRY_RUN ? ' (DRY RUN, nada modificado)' : ' (cambios aplicados)'));
