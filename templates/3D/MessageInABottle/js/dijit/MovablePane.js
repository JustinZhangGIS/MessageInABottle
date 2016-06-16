define([
    "dojo/_base/declare",
    "dojo/dom-class",
    "dojo/dnd/Moveable",
    "dijit/Fieldset",
    "dijit/_WidgetBase",
    "dijit/_TemplatedMixin",
    "dijit/_WidgetsInTemplateMixin",
    "dojo/text!./template/MovablePane.html"
], function (declare, domClass, Moveable, Fieldset,
             _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, dijitTemplate) {

    var MovablePane = declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {

        declaredClass: "MovablePane",
        baseClass: "apl-movable-pane",
        templateString: dijitTemplate,

        open: false,
        title: "Movable Pane",
        moveHandleTitle: "Move Pane",

        /**
         *
         * @param config
         */
        constructor: function (config) {
            declare.safeMixin(this, config);
        },

        /**
         *
         */
        postCreate: function () {
            this.inherited(arguments);
            // MAKE MOVABLE //
            this.movablePane = new Moveable(this.domNode, {handle: this.moveHandleNode});
        },

        /**
         *
         * @param title
         * @private
         */
        _setTitleAttr: function (title) {
            this.container.set("title", title);
        },

        /**
         *
         * @param disabled
         * @private
         */
        _setDisabledAttr: function (disabled) {
            domClass.toggle(this.domNode, "dijitDisabled", disabled);
        },

        /**
         *
         */
        toggle: function () {
            this.container.toggle();
        }

    });

    // VERSION //
    MovablePane.version = "0.0.1";

    return MovablePane;
});