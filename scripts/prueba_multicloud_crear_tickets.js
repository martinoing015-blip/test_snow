/*
 * PRUEBA Solicitud Masiva Entorno Multicloud — 1) Crear tickets de prueba
 * Crea 6 RITM (uno por camino del Flow) con previsto = usuario de prueba.
 * Descripción de cada uno empieza con "PRUEBA SMMC" para encontrarlos después.
 *
 * Cuenta: ADMIN | DRY_RUN=true solo lectura (muestra qué crearía) | DRY_RUN=false CREA REQ/RITM
 * Ojo: por script no corren las policies del formulario (eso se prueba a mano en el portal);
 * esto prueba el Flow: aprobaciones según Acción y WO según Célula.
 */
var DRY_RUN = true;
var ITEM_ID = '31c840631be3325058f65425604bcb53';
var USER = '43a9c5093bc703106977352eb3e45ab0';   // usuario de prueba (previsto)
var P = 'u_sol_mas_ent_mcld_';

gs.print('DRY_RUN = ' + DRY_RUN);
function varRec(name) {
    var v = new GlideRecord('item_option_new'); v.addQuery('name', name);
    v.addQuery('cat_item', ITEM_ID).addOrCondition('variable_set', 'IN', setIds()); v.query();
    return v.next() ? v : null;
}
var _sets = null;
function setIds() {
    if (_sets) return _sets;
    _sets = []; var s = new GlideRecord('io_set_item'); s.addQuery('sc_cat_item', ITEM_ID); s.query();
    while (s.next()) _sets.push(s.getValue('variable_set'));
    return _sets.join(',');
}
// value activo de Acción según su texto (sirve con values antiguos o nuevos)
function accion(texto) {
    var a = varRec(P + 'accion_requerida');
    var c = new GlideRecord('question_choice');
    c.addQuery('question', a.getUniqueValue()); c.addQuery('text', texto); c.addQuery('inactive', false); c.query();
    return c.next() ? c.getValue('value') : null;
}
// una célula cualquiera para los casos con célula = Sí
function celula() {
    var v = varRec('seleccione_c_lula'); if (!v) return '';
    var t = v.getValue('reference'); if (!t) return '';
    var g = new GlideRecord(t); if (g.isValidField('active')) g.addQuery('active', true); g.setLimit(1); g.query();
    return g.next() ? g.getUniqueValue() : '';
}

var CREA = accion('Creación'), MOD = accion('Modificación'), ELIM = accion('Eliminación'), CEL = celula();
gs.print('Acción: Creación=' + CREA + ' | Modificación=' + MOD + ' | Eliminación=' + ELIM + ' | célula de prueba=' + (CEL || '❌ no encontrada'));
var cad = new GlideDateTime(); cad.addDaysUTC(30);

var CASOS = [
    { n: 1, t: 'Creación + Azure + rol Si + T1 Si + Definida | célula No', esp: 'Jefatura 2 niveles → WO (célula No)',
      v: { accion_requerida: CREA, ambiente_cloud: 'microsoft_azure', requiere_rol_admin: 'si', posee_cuenta_t1: 'si', cuenta_t1: 'T1PRUEBA01',
           vigencia: 'definida', caducidad_vigencia: cad.getValue() }, cel: false },
    { n: 2, t: 'Creación + GCP + Dominio de datos + matriz + Indefinida | célula Sí', esp: 'Jefatura 2 niveles → WO (célula Sí)',
      v: { accion_requerida: CREA, ambiente_cloud: 'google_cloud_platform', requiere_rol_admin_gcp: 'dominio_datos', matriz_gcp: 'MATRIZ_PRUEBA_GCP',
           vigencia: 'Indefinida' }, cel: true },
    { n: 3, t: 'Modificación + AWS + rol No + Indefinida | célula No', esp: 'Jefatura 2 niveles → WO (célula No)  ← caso que antes no entraba al Flow',
      v: { accion_requerida: MOD, ambiente_cloud: 'amazon_web_service', requiere_rol_admin: 'no', vigencia: 'Indefinida' }, cel: false },
    { n: 4, t: 'Modificación + GCP + Consola + T1 No + Definida | célula Sí', esp: 'Jefatura 2 niveles → WO (célula Sí)',
      v: { accion_requerida: MOD, ambiente_cloud: 'google_cloud_platform', requiere_rol_admin_gcp: 'consola_administracion', posee_cuenta_t1: 'no',
           vigencia: 'definida', caducidad_vigencia: cad.getValue() }, cel: true },
    { n: 5, t: 'Eliminación + OCI + T1 Si + rol a eliminar | célula No', esp: 'Jefatura 1 nivel → WO (célula No)',
      v: { accion_requerida: ELIM, ambiente_cloud: 'oracle_cloud_infrastructure', posee_cuenta_t1: 'si', cuenta_t1: 'T1PRUEBA05', rol_eliminar: 'ROL_PRUEBA_OCI' }, cel: false },
    { n: 6, t: 'Eliminación + GCP + rol a eliminar | célula Sí', esp: 'Jefatura 1 nivel → WO (célula Sí)',
      v: { accion_requerida: ELIM, ambiente_cloud: 'google_cloud_platform', rol_eliminar: 'ROL_PRUEBA_GCP' }, cel: true }
];

if (!CREA || !MOD || !ELIM) gs.print('❌ No se encontraron las 3 opciones activas de Acción; no se crea nada');
else CASOS.forEach(function (c) {
    var vars = {};
    for (var k in c.v) vars[P + k] = c.v[k];
    vars[P + 'cantidad_usuarios'] = '3';
    vars[P + 'desc_solicitud'] = 'PRUEBA SMMC #' + c.n + ' - ' + c.t;
    vars[P + 'proyecto'] = 'no';
    vars['esta_solicitud_esta_asociada_a_una_c_lula'] = c.cel ? 'Yes' : 'No';
    if (c.cel) vars['seleccione_c_lula'] = CEL;

    gs.print('\n#' + c.n + ' ' + c.t + '\n   esperado: ' + c.esp);
    if (c.cel && !CEL) { gs.print('   ❌ sin célula de prueba, se omite'); return; }
    if (DRY_RUN) { gs.print('   variables: ' + JSON.stringify(vars)); return; }
    try {
        var cart = new sn_sc.CartJS();
        var r = cart.orderNow({ sysparm_id: ITEM_ID, sysparm_quantity: '1', sysparm_requested_for: USER, variables: vars });
        var ritm = new GlideRecord('sc_req_item'); ritm.addQuery('request', r.request_id); ritm.query();
        gs.print('   ✅ ' + r.request_number + ' / ' + (ritm.next() ? ritm.getValue('number') : '(RITM no encontrado)'));
    } catch (e) { gs.print('   ❌ error: ' + e); }
});
gs.print('\nFIN' + (DRY_RUN ? ' (DRY RUN, nada creado)' : ' (tickets creados; esperar 1-2 min y correr el script de revisión)'));
