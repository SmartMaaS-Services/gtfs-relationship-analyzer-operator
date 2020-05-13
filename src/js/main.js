/*
 * gtfs-relationship-analyzer
 * https://github.com/yclausen/gtfs-relationship-analyzer-operator
 *
 * Copyright (c) 2020 FIWARE
 * Licensed under the MIT license.
 */

/* globals MashupPlatform */
var gtfsShape = {},
    gtfsStop = {},
    gtfsStation = {},
    gtfsRoute = {},
    gtfsAgency = {},
    mergeEntities = {},
    filteredEntities = {};

(function () {

    "use strict";

    var parseInputEndpointData = function parseInputEndpointData(entities) {
        if (typeof entities === "string") {
            try {
                entities = JSON.parse(entities);
            } catch (e) {
                throw new MashupPlatform.wiring.EndpointTypeError();
            }
        }

        if (entities == null || typeof entities !== "object") {
            throw new MashupPlatform.wiring.EndpointTypeError();
        }

        if (!Array.isArray(entities)) {
            entities = [entities];
        }

        return entities;
    };

    var registerGtfsTypes = function registerGtfsTypes(entity) {
        switch (entity.type) {
            case 'GtfsStop':
                gtfsStop[entity.id] = entity;
                break;
            case 'GtfsStation':
                gtfsStation[entity.id] = entity;
                break;
            case 'GtfsShape':
                gtfsShape[entity.id] = entity;
                break;
            case 'GtfsRoute':
                gtfsRoute[entity.id] = entity;
                break;
            case 'GtfsAgency':
                gtfsAgency[entity.id] = entity;
                break;
        }
    };

    var filterDatasets = function filterDatasets() {
        for (const entity in mergeEntities) {
            if (mergeEntities.hasOwnProperty(entity)) {
                if (Object.keys(mergeEntities[entity]).length === 5 ) {
                    filteredEntities[entity] = mergeEntities[entity];
                }
            }
        }
    };

    var mergeDatasets = function mergeDatasets() {
        // Type Route contains the name for the Type Shape.
        // Route does not contain any relevant information at the moment and is therefore ignored for the time being
        for (const entity in filteredEntities) {
            if (filteredEntities.hasOwnProperty(entity)) {
                filteredEntities[entity].gtfsShape['name'] = filteredEntities[entity].gtfsRoute.name;
                filteredEntities[entity].gtfsShape['routeType'] = filteredEntities[entity].gtfsRoute.routeType;
            }
        }
    };

    var create_union = function create_union() {
        if (Object.keys(gtfsShape).length !== 0 && Object.keys(gtfsStop).length !== 0 && Object.keys(gtfsStation).length !== 0 && Object.keys(gtfsRoute).length !== 0 && Object.keys(gtfsAgency).length !== 0) {

            if (Object.keys(gtfsShape).length === Object.keys(gtfsRoute).length) {
                for (const shape_entity in gtfsShape) {
                    if (gtfsShape.hasOwnProperty(shape_entity)) {
                        for (const route_entity in gtfsRoute) {
                            if (gtfsRoute.hasOwnProperty(route_entity)) {
                                if (gtfsShape[shape_entity].id.replace('GtfsShape:', '') === gtfsRoute[route_entity].id.replace('GtfsRoute:', '')) {
                                    mergeEntities['mergeEntities:'+ gtfsShape[shape_entity].id.replace('GtfsShape:', '')] = {'gtfsShape':gtfsShape[shape_entity], 'gtfsRoute':gtfsRoute[route_entity]};
                                }
                            }
                        }
                    }
                }

                for (const entity in mergeEntities) {
                    if (mergeEntities.hasOwnProperty(entity)) {
                        var routes = mergeEntities[entity].gtfsRoute;
                        var routeId = routes.id.replace('GtfsRoute:', '').split('-');
                        var origin_route_ID = routeId[0];
                        var destination_route_ID = routeId[1].replace(':MS', '');

                        for (const entity_agency in gtfsAgency) {
                            if (gtfsAgency.hasOwnProperty(entity_agency)) {
                                for (const data in routes) {
                                    if (routes.hasOwnProperty(data)) {
                                        if (gtfsAgency[entity_agency].id === routes.operatedBy) {
                                            mergeEntities[entity]['gtfsAgency'] = gtfsAgency[entity_agency];
                                        }
                                    }
                                }
                            }
                        }

                        for (const station_entity in gtfsStation) {
                            if (gtfsStation.hasOwnProperty(station_entity)) {
                                var stations_collection = [];

                                if(gtfsStation[station_entity].id.includes(origin_route_ID) || gtfsStation[station_entity].id.includes(destination_route_ID)) {
                                    stations_collection.push(gtfsStation[station_entity]);
                                    mergeEntities[entity]['gtfsStation'] = stations_collection
                                }
                            }
                        }

                        for (const stop_entity in gtfsStop) {
                            if (gtfsStop.hasOwnProperty(stop_entity)) {
                                var stops_collection = [];

                                if (mergeEntities.hasOwnProperty(entity) && mergeEntities[entity].hasOwnProperty('gtfsStation')) {
                                    var stations = mergeEntities[entity].gtfsStation;
                                    for (const data in stations) {
                                        if (stations.hasOwnProperty(data)) {
                                            if (gtfsStop[stop_entity].hasParentStation === stations[data].id) {
                                                stops_collection.push(gtfsStop[stop_entity]);
                                                mergeEntities[entity]['gtfsStop'] = stops_collection;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    };

    var sendGtfsTypeData = function sendGtfsTypeData() {

        if (!MashupPlatform.operator.outputs.shapeOutput.connected && !MashupPlatform.operator.outputs.stationOutput.connected && !MashupPlatform.operator.outputs.stopOutput.connected) {
            return;
        }

        let stopOutput = [];
        let stationOutput = [];
        let shapeOutput = [];
        for (const entity_type in filteredEntities) {
            if (filteredEntities.hasOwnProperty(entity_type)) {
                shapeOutput.push(filteredEntities[entity_type].gtfsShape);

                for (const data in filteredEntities[entity_type].gtfsStation) {
                    if (filteredEntities[entity_type].gtfsStation.hasOwnProperty(data)) {
                        stationOutput.push(filteredEntities[entity_type].gtfsStation[data]);
                    }
                }

                for (const data in filteredEntities[entity_type].gtfsStop) {
                    if (filteredEntities[entity_type].gtfsStop.hasOwnProperty(data)) {
                        stopOutput.push(filteredEntities[entity_type].gtfsStop[data]);
                    }
                }
            }
        }

        if (stopOutput.length > 0){
            MashupPlatform.wiring.pushEvent('stopOutput', stopOutput);
        }

        if (stationOutput.length > 0){
            MashupPlatform.wiring.pushEvent('stationOutput', stationOutput);
        }

        if (shapeOutput.length > 0){
            MashupPlatform.wiring.pushEvent('shapeOutput', shapeOutput);
        }

    };


    if (window.MashupPlatform != null) {
        var entities;

        MashupPlatform.wiring.registerCallback("GtfsTypesInput", function (data) {
            entities = parseInputEndpointData(data);
            entities.forEach(registerGtfsTypes);
            create_union();
            filterDatasets();
            mergeDatasets();
            sendGtfsTypeData();
        });

    }

})();
