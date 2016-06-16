/*global define,document */
/*jslint sloppy:true,nomen:true */
/*
 | Copyright 2014 Esri
 |
 | Licensed under the Apache License, Version 2.0 (the "License");
 | you may not use this file except in compliance with the License.
 | You may obtain a copy of the License at
 |
 |    http://www.apache.org/licenses/LICENSE-2.0
 |
 | Unless required by applicable law or agreed to in writing, software
 | distributed under the License is distributed on an "AS IS" BASIS,
 | WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 | See the License for the specific language governing permissions and
 | limitations under the License.
 */
define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/_base/array",
    "dojo/_base/Color",
    "dojo/colors",
    "dojo/Deferred",
    "dojo/query",
    "dojo/on",
    "dojo/dom",
    "dojo/dom-class",
    "dojo/dom-style",
    "put-selector/put",
    "dgrid/List",
    "dgrid/Selection",
    "dgrid/extensions/DijitRegistry",
    "dijit/registry",
    "esri/core/watchUtils",
    "esri/Map",
    "esri/WebScene",
    "esri/portal/PortalItem",
    "esri/views/MapView",
    "esri/views/SceneView",
    "esri/PopupTemplate",
    "esri/widgets/Search",
    "esri/widgets/Search/SearchViewModel",
    "esri/widgets/BasemapToggle",
    "esri/widgets/BasemapToggle/BasemapToggleViewModel",
    "esri/Graphic",
    "esri/layers/GraphicsLayer",
    "esri/layers/FeatureLayer",
    "esri/renderers/SimpleRenderer",
    "esri/geometry/Point",
    "esri/geometry/Polyline",
    "esri/geometry/support/normalizeUtils",
    "esri/symbols/PointSymbol3D",
    "esri/symbols/ObjectSymbol3DLayer",
    "esri/symbols/LineSymbol3D",
    "esri/symbols/PathSymbol3DLayer",
    "esri/symbols/PolygonSymbol3D",
    "esri/symbols/LineSymbol3DLayer",
    "esri/symbols/FillSymbol3DLayer",
    "esri/geometry/geometryEngine",
    "esri/tasks/Geoprocessor",
    "esri/tasks/support/FeatureSet"
], function (declare, lang, array, Color, colors, Deferred, query, on, dom, domClass, domStyle, put,
             List, Selection, DijitRegistry, registry,
             watchUtils, Map, WebScene, PortalItem, MapView, SceneView, PopupTemplate, Search, SearchViewModel, BasemapToggle, BasemapToggleViewModel,
             Graphic, GraphicsLayer, FeatureLayer, SimpleRenderer, Point, Polyline, normalizeUtils,
             PointSymbol3D, ObjectSymbol3DLayer, LineSymbol3D, PathSymbol3DLayer, PolygonSymbol3D, LineSymbol3DLayer, FillSymbol3DLayer,
             geometryEngine, Geoprocessor, FeatureSet) {

    /**
     * MAIN APPLICATION
     */
    var MainApp = declare(null, {

        // ARE WE CURRENTLY ANIMATING A RESULT //
        animatingPath: false,

        /**
         * CONSTRUCTOR
         *
         * @param config
         */
        constructor: function (config) {
            declare.safeMixin(this, config);
        },

        /**
         * STARTUP
         */
        startup: function () {
            var itemIdOrItemInfo = (this.webscene || this.webmap || this.itemInfo);
            if(itemIdOrItemInfo) {
                this.initializeMap(itemIdOrItemInfo);
            } else {
                MainApp.displayMessage(new Error("itemInfo, webmap, or webscene parameter not defined"));
            }
        },

        /**
         * INITIALIZE THE MAP
         *
         * @param webSceneItemId
         */
        initializeMap: function (webSceneItemId) {

            MainApp.displayMessage("Loading Map...");

            // SCENE VIEW //
            this.sceneView = new SceneView({
                container: "scene-node",
                map: new WebScene({
                    portalItem: new PortalItem({
                        id: webSceneItemId
                    })
                })
            });
            this.sceneView.then(function () {
                this._whenFinishedUpdatingOnce(this.sceneView).then(function () {

                    // INITIALIZE SEARCH //
                    this.initializeSearch(this.sceneView);

                    // INITIALIZE BASEMAP TOGGLE //
                    this.initializeBasemapToggle(this.sceneView);

                    // INITIALIZE TIDE STATIONS SELECTION //
                    this.initializeTideStationSelection();

                    // OTHER CODE HERE
                    this.otherCodeGoesHere();

                    // CLEAR WELCOME MESSAGE //
                    MainApp.displayMessage();

                }.bind(this), MainApp.displayMessage);
            }.bind(this), MainApp.displayMessage);

        },

        /**
         *
         * @param view
         * @returns {Promise}
         * @private
         */
        _whenFinishedUpdatingOnce: function (view) {
            return watchUtils.whenTrueOnce(view, "updating").then(function () {
                return watchUtils.whenFalseOnce(view, "updating");
            }.bind(this), console.warn);
        },

        /**
         *
         * @param view
         */
        initializeBasemapToggle: function (view) {

            // BASEMAP TOGGLE //
            var basemapToggle = new BasemapToggle({
                viewModel: new BasemapToggleViewModel({
                    view: view,
                    secondaryBasemap: "gray"
                })
            }, "basemap-toggle-node");
            basemapToggle.startup();

        },

        /**
         *
         */
        initializeSearch: function (view) {

            /**
             * SEARCH
             *
             * http://jscore.esri.com/javascript/4/api-reference/esri-widgets-Search.html
             * http://jscore.esri.com/javascript/4/api-reference/esri-widgets-Search-SearchViewModel.html
             * https://developers.arcgis.com/rest/geocode/api-reference/geocoding-category-filtering.htm
             * https://developers.arcgis.com/rest/geocode/api-reference/geocode-coverage.htm
             */
            var searchWidget = new Search({
                viewModel: {
                    view: view,
                    autoNavigate: true,
                    autoSelect: true,
                    highlightEnabled: true,
                    labelEnabled: false,
                    popupEnabled: false,
                    showPopupOnSelect: false
                }
            }, "search-node");
            searchWidget.startup();

        },

        /**
         *
         * @param cursor
         * @private
         */
        _setMapCursor: function (cursor) {
            domStyle.set(this.sceneView.container, "cursor", cursor || "default");
        },

        /**
         *
         */
        otherCodeGoesHere: function () {

            // SET START DATE TO TODAY //
            registry.byId("start-date-input").set("value", new Date());

            // ANIMATION SYMBOL //
            this.alongSymbol = new PointSymbol3D({
                symbolLayers: [
                    new ObjectSymbol3DLayer({
                        width: 100000.0,
                        material: {
                            color: Color.named.red
                        },
                        resource: {
                            primitive: "sphere"
                        }
                    })
                ]
            });

            // START LOCATION //
            this.pointSymbol = new PointSymbol3D({
                symbolLayers: [
                    new ObjectSymbol3DLayer({
                        width: 100000.0,
                        height: 800000.0,
                        material: {
                            color: Color.named.lime
                        },
                        resource: {
                            primitive: "cylinder"
                        }
                    })
                ]
            });

            // CURRENTS PATHS TASK RESULTS //
            this.pathSymbol = LineSymbol3D({
                symbolLayers: [
                    new PathSymbol3DLayer({
                        size: 50000.0,
                        profile: "tube",
                        material: {
                            color: Color.named.gold
                        }
                    })
                ]
            });

            // CURRENTS PATHS BUFFER //
            this.bufferSymbol = PolygonSymbol3D({
                symbolLayers: [
                    new FillSymbol3DLayer({
                        material: {
                            color: Color.named.lime.concat(0.66)
                        }
                    }),
                    new LineSymbol3DLayer({
                        size: 2.5,
                        material: {
                            color: Color.named.lime
                        }
                    })
                ]
            });

            // RESULTS GRAPHICS LAYER //
            this.graphicsLayer = new GraphicsLayer({
                minScale: 0,
                maxScale: 0
            });
            this.sceneView.map.add(this.graphicsLayer);

            // DEFAULT MAP CURSOR //
            this._setMapCursor("crosshair");

            // VIEW CLICK //
            this.sceneView.on("click", function (evt) {
                if((!this.animatingPath) && (evt.mapPoint != null)) {
                    this.sceneView.popup.visible = false;
                    this.animatingPath = true;
                    this.doAnalysis(evt.mapPoint);
                }
            }.bind(this));

            // CLEAR RESULTS //
            on(dom.byId("clear-results"), "click", this.clearAnalysis.bind(this));

        },

        /**
         *
         */
        clearAnalysis: function () {
            this.sceneView.popup.visible = false;
            dom.byId("stations-node").innerHTML = "";
            this.graphicsLayer.removeAll();
            this.selectedTideStationsLayer.removeAll();
        },

        /**
         *
         * @param mapPoint
         */
        doAnalysis: function (mapPoint) {

            this.clearAnalysis();

            this._setMapCursor("wait");

            // START LOCATION //
            var startLocationGraphic = new Graphic(mapPoint, this.pointSymbol);
            this.graphicsLayer.add(startLocationGraphic);

            // OCEAN CURRENTS TASK //
            var inputTaskParameters = {
                "Input_Location": new FeatureSet({
                    features: [
                        new Graphic({
                            geometry: new Point({
                                longitude: mapPoint.longitude,
                                latitude: mapPoint.latitude
                            })
                        })
                    ]
                }),
                "Start_Date": registry.byId("start-date-input").get("value").valueOf(),
                "Number_of_Days": registry.byId("number-of-days-input").get("value")
            };

            // OCEAN CURRENTS TASK //
            var oceansCurrentsTask = new Geoprocessor({
                url: "//maps.esri.com/apl15/rest/services/OceanCurrents/TrackCurrents/GPServer/TrackCurrentFromThisLocation",
                outSpatialReference: this.sceneView.spatialReference
            });
            oceansCurrentsTask.execute(inputTaskParameters).then(function (taskResponse) {

                // GET FEATURESET //
                var resultsFeatureSet = taskResponse.results[0].value;

                // UNION RESULTS PATH //
                var currentsLine = this._createSinglePath(resultsFeatureSet.features);

                // ANIMATE PATH //
                this.animatePath(currentsLine);

            }.bind(this), function (error) {
                console.warn(error);

                this.graphicsLayer.remove(startLocationGraphic);
                this._setMapCursor("crosshair");
                this.animatingPath = false;

                alert(error.message);
            }.bind(this));

        },


        /**
         *
         * @param features
         * @private
         */
        _createSinglePath: function (features) {

            /**
             * THE GP SERVICE RETURNS A FEATURE FOR EACH POSSIBLE SEASON AND
             * EACH FEATURE MAY HAVE MULTIPLE PARTS IF CROSSING 180. WE TRIED
             * SIMPIFYING AND OTHER TECHNIQUES BUT HAVE EVENTUALLY DECIDED
             * THAT THIS IS BEST HANDLED INSIDE THE SERVICE SO WE'LL REVISIT
             * THE SERVICE TO DEAL WITH THIS ISSUE THERE. FOR NOW WE TRY TO
             * COMBINE THEM ALL INTO A SINGLE POLYLINE, BUT IDEALLY WE'D GET
             * BACK A SINGLE FEATURE WITH A POLYLINE THAT HAS A SINGLE PATH.
             *
             * *** WHAT WE NEED IN esri/geometry/geometryEngine IS THE
             *     EQUIVALENT TO THE simplifyPolyline() ArcObjects METHOD
             */

            var currentsPaths = [];
            array.forEach(features, function (feature) {
                //console.info("Paths: ", feature.geometry.paths.length);
                currentsPaths = currentsPaths.concat(feature.geometry.paths.reverse());
            }.bind(this));
            console.info("currentsPath: ", currentsPaths.length, currentsPaths);

            var currentsLine = new Polyline({
                spatialReference: this.sceneView.spatialReference,
                paths: currentsPaths
            });

            return currentsLine;  // geometryEngine.simplify(currentsLine);

            //var simplifiedCurrentsLine= geometryEngine.simplify(currentsLine);

            //return normalizeUtils.normalizeCentralMeridian([simplifiedCurrentsLine]).then(function (normalizedGeometries) {
            //  return normalizedGeometries[0];
            //}.bind(this), console.warn);

            //return geometryEngine.simplify(currentsLine);
        },

        /**
         *
         * @param polyline
         */
        animatePath: function (polyline) {

            this.animationParams = {
                bufferDistance: registry.byId("buffer-distance-input").get("value"),
                animationSpeed: registry.byId("animation-speed").get("value")
            };

            // ANIMATION PATH //
            this.animationPath = geometryEngine.geodesicDensify(polyline, this.animationParams.animationSpeed, "kilometers");

            // INITIAL PATH AND COORDINATE INDEX //
            this.pathIdx = 0;
            this.coordIdx = 0;

            // START ANIMATION //
            window.requestAnimationFrame(this._displayPath.bind(this));


            /*this.sceneView.map.basemap.baseLayers.forEach(function (layer) {
             layer.opacity = 0.5;
             });*/

        },

        /**
         *
         * @private
         */
        _displayPath: function () {

            // REMOVE PREVIOUS //
            window.requestAnimationFrame(this._pathCleanup.bind(this));

            // SLICE PATH //
            var slicedPaths = this.animationPath.paths.slice(0, this.pathIdx);
            var slicedPath = this.animationPath.paths[this.pathIdx].slice(0, this.coordIdx);

            // DO WE HAVE ENOUGH PATHS/POINTS TO DISPLAY //
            if((slicedPaths.length > 0) || (slicedPath.length > 1)) {

                // PATH GEOMETRY //
                var pathGeometry = new Polyline({
                    spatialReference: this.animationPath.spatialReference,
                    paths: (slicedPaths.length > 0) ? slicedPaths.concat([slicedPath]) : [slicedPath]
                });

                // PATH GRAPHIC //
                this.pathGraphic = new Graphic({
                    symbol: this.pathSymbol,
                    geometry: geometryEngine.simplify(pathGeometry)
                });

                // BUFFER GRAPHIC //
                var pathBuffer = geometryEngine.geodesicBuffer(this.pathGraphic.geometry, this.animationParams.bufferDistance, "kilometers", true);
                this.bufferGraphic = new Graphic(pathBuffer, this.bufferSymbol);

                // ADD GRAPHICS //
                this.graphicsLayer.addMany([
                    this.bufferGraphic,
                    this.pathGraphic
                ]);

                // SELECT TIDAL STATIONS //
                window.requestAnimationFrame(this.selectTideStations.bind(this, pathBuffer));
            }

            // UPDATE COORDINATE INDEX //
            if(++this.coordIdx < this.animationPath.paths[this.pathIdx].length) {
                window.requestAnimationFrame(this._displayPath.bind(this));
            } else {
                // UPDATE PATH INDEX //
                if(++this.pathIdx < this.animationPath.paths.length) {
                    this.coordIdx = 0;
                    window.requestAnimationFrame(this._displayPath.bind(this));
                } else {
                    // WE'VE REACHED THE END OF THE POLYLINE //
                    window.requestAnimationFrame(this._pathCleanup.bind(this));

                    // ADD GRAPHICS //
                    // THIS DOESN'T WORK AS SYMBOL FAILS WITH CALL TO .clone() //
                    //this.graphicsLayer.addMany([this.bufferGraphic.clone(), this.pathGraphic.clone()]);
                    this.graphicsLayer.addMany([
                        new Graphic(this.bufferGraphic.geometry.clone(), this.bufferSymbol),
                        new Graphic(this.pathGraphic.geometry.clone(), this.pathSymbol)
                    ]);

                    // FINISH ANIMATION //
                    this.animatingPath = false;
                    this._setMapCursor("crosshair");

                    /*this.sceneView.map.basemap.baseLayers.forEach(function (layer) {
                     layer.opacity = 1.0;
                     });*/
                }
            }
        },

        /**
         *
         * @private
         */
        _pathCleanup: function () {
            if(this.pathGraphic && this.bufferGraphic) {
                this.graphicsLayer.removeMany([
                    this.pathGraphic,
                    this.bufferGraphic
                ]);
                this.pathGraphic = null;
                this.bufferGraphic = null;
            }
        },

        /**
         *
         */
        initializeTideStationSelection: function () {

            // TIDE STATIONS LAYER //
            this.tideStationsLayer = this.sceneView.map.layers.find(function (layer) {
                return (layer.title === "Tide Stations");
            });
            if(this.tideStationsLayer) {
                // TIDE STATIONS GRAPHICS //
                this.sceneView.whenLayerView(this.tideStationsLayer).then(function (layerView) {
                    console.info("Tide Stations: ", this.tideStationsLayer);

                    var graphicsController = layerView.controller;
                    graphicsController.then(function () {
                        watchUtils.whenTrueOnce(graphicsController, "hasAllFeatures", function () {
                            this.tideStationsGraphics = graphicsController.graphics;
                            domClass.remove(registry.byId("stations-pane").domNode, "dijitHidden");
                        }.bind(this));
                    }.bind(this));

                }.bind(this));

                // SELECTED TIDE STATIONS //
                this.selectedTideStationsLayer = new GraphicsLayer({
                    renderer: new SimpleRenderer({
                        symbol: new PointSymbol3D({
                            symbolLayers: [
                                new ObjectSymbol3DLayer({
                                    width: 150000.0,
                                    material: {
                                        color: Color.named.orange
                                    },
                                    resource: {
                                        primitive: "sphere"
                                    }
                                })
                            ]
                        })
                    })
                });
                this.sceneView.map.add(this.selectedTideStationsLayer);
            }

        },

        /**
         *
         * @param buffer
         */
        selectTideStations: function (buffer) {

            if(this.tideStationsLayer && this.tideStationsGraphics) {

                // CLEAR PREVIOUS TIDE STATIONS //
                dom.byId("stations-node").innerHTML = "";

                // CLEAR PREVIOUS SELECTED TIDE STATIONS //
                this.selectedTideStationsLayer.removeAll();

                var graphicsInBuffer = this.tideStationsGraphics.filter(function (graphic) {
                    return buffer.contains(graphic.geometry);
                }.bind(this)).map(function (graphicInBuffer) {

                    this.addTideStationToList(graphicInBuffer);

                    return graphicInBuffer.clone();
                }.bind(this));

                if(graphicsInBuffer.length > 0) {
                    this.selectedTideStationsLayer.addMany(graphicsInBuffer);
                }
            }
        },

        /**
         *
         * @param tideStationGraphic
         */
        addTideStationToList: function (tideStationGraphic) {

            // STATION NODE //
            var stationNode = put(dom.byId("stations-node"), "div.station-node");

            // SYMBOL //
            var tideStationSymbol = this.tideStationsLayer.renderer.getSymbol(tideStationGraphic);
            if(tideStationSymbol) {
                put(stationNode, "div.station-symbol", {
                    style: lang.replace("border-left-color:rgba({r},{g},{b},{a})", tideStationSymbol.color)
                });
            }

            // ATTRIBUTES - stationid, stationtyp, url //
            put(stationNode, "span", {
                innerHTML: lang.replace("<b>{stationid}</b> - {stationtyp}", tideStationGraphic.attributes)
            });

            // STATION NODE CLICK //
            on(stationNode, "click", function () {
                this.sceneView.popup.viewModel.location = tideStationGraphic.geometry;
                this.sceneView.popup.viewModel.content = put("iframe.station-details", { src: tideStationGraphic.attributes.url });
                if(!this.sceneView.popup.visible) {
                    this.sceneView.popup.visible = true;
                }
            }.bind(this));

        }

    });

    /**
     *  DISPLAY MESSAGE OR ERROR
     *
     * @param messageOrError {string | Error}
     * @param smallText {boolean}
     */
    MainApp.displayMessage = function (messageOrError, smallText) {
        require(["dojo/query", "put-selector/put"], function (query, put) {
            query(".message-node").orphan();
            if(messageOrError) {
                if(messageOrError instanceof Error) {
                    put(document.body, "div.message-node.error-node span", messageOrError.message);
                } else {
                    if(messageOrError.declaredClass === "esri.tasks.GPMessage") {
                        var simpleMessage = messageOrError.description;
                        put(document.body, "div.message-node span.esriJobMessage.$ span.small-text $", messageOrError.type, simpleMessage);
                    } else {
                        put(document.body, smallText ? "div.message-node span.small-text" : "div.message-node span", messageOrError);
                    }
                }
            }
        });
    };

    MainApp.version = "0.0.3";

    return MainApp;
});