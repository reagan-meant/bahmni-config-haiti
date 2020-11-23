'use strict';

angular.module('bahmni.common.displaycontrol.custom')
    .directive('vaccination', ['observationsService', 'appService', 'spinner', '$q', function (observationsService, appService, spinner, $q) {
        var link = function ($scope) {

            $scope.contentUrl = appService.configBaseUrl() + "/customDisplayControl/views/vaccination.html";

            $scope.vaccinations = [];

            // If the configration parameter is not present, return an promise that resolves an empty array
            var fetchVaccinationSets = {};
            if ($scope.config.vaccinationSets == undefined) {
                var deferred = $q.defer()
                deferred.resolve([])
                fetchVaccinationSets = deferred.promise;
            } else {
                fetchVaccinationSets = spinner.forPromise(observationsService.fetch($scope.patient.uuid, $scope.config.vaccinationSets, undefined, undefined, undefined, undefined))
            }

            fetchVaccinationSets.then(function (response) {
                var vaccinationSets = response.data;
                vaccinationSets = _.map(vaccinationSets, function (item, index) {
                    var vaccination = {}

                    for (var x of item.groupMembers) {
                        if (x.concept.name == 'Vaccinations') {
                            vaccination.conceptUuid = x.conceptUuid;
                            vaccination.name = x.valueAsString;
                            vaccination.fullySpecifiedName = x.value.name;
                        } else if (x.concept.name == 'Vaccination date') {
                            vaccination.vaccinationDate = x.value;
                        } else if (x.concept.name == 'Vaccination sequence number') {
                            vaccination.vaccationSequenceValue = x.value;
                        } else if (x.concept.name == 'Vaccine Manufacturer') {
                            vaccination.vaccationManufacturer = x.valueAsString;
                        } else if (x.concept.name == 'Vaccine Lot Number') {
                            vaccination.vaccineLotNumber = x.value;
                        } else if (x.concept.name == 'Vaccine lot expiration date') {
                            vaccination.vaccinationExpiryDate = x.value;
                        }
                    }

                    $scope.vaccinations.push(vaccination);
                    return vaccination
                });

            });

        };
        return {
            restrict: 'E',
            link: link,
            template: '<ng-include src="contentUrl"/>'
        }
    }]).controller('vaccinationDetailsController', ['$scope',
        function ($scope) {
            $scope.vaccinations = $scope.ngDialogData;

            function groupBy(objectArray, property) {
                return objectArray.reduce(function (acc, obj) {
                    var key = obj[property];
                    if (!acc[key]) {
                        acc[key] = [];
                    }
                    acc[key].push(obj);
                    return acc;
                }, {});
            }

            $scope.groupedvaccination = groupBy($scope.vaccinations, 'name');

        }]).filter("unique", function () {
            // we will return a function which will take in a collection
            // and a keyname
            return function (collection, keyname) {
                // we define our output and keys array;
                var output = [],
                    keys = [];

                // we utilize angular's foreach function
                // this takes in our original collection and an iterator function
                angular.forEach(collection, function (item) {
                    // we check to see whether our object exists
                    var key = item[keyname];
                    // if it's not already part of our keys array
                    if (keys.indexOf(key) === -1) {
                        // add it to our keys array
                        keys.push(key);
                        // push this item to our final output array
                        output.push(item);
                    }
                });
                // return our array which should be devoid of
                // any duplicates
                return output;
            };
        })
    .directive('birthCertificate', ['observationsService', 'appService', 'spinner', function (observationsService, appService, spinner) {
        var link = function ($scope) {
            var conceptNames = ["HEIGHT"];
            $scope.contentUrl = appService.configBaseUrl() + "/customDisplayControl/views/birthCertificate.html";
            spinner.forPromise(observationsService.fetch($scope.patient.uuid, conceptNames, "latest", undefined, $scope.visitUuid, undefined).then(function (response) {
                $scope.observations = response.data;
            }));
        };

        return {
            restrict: 'E',
            template: '<ng-include src="contentUrl"/>',
            link: link
        }
    }]).directive('deathCertificate', ['observationsService', 'appService', 'spinner', function (observationsService, appService, spinner) {
        var link = function ($scope) {
            var conceptNames = ["WEIGHT"];
            $scope.contentUrl = appService.configBaseUrl() + "/customDisplayControl/views/deathCertificate.html";
            spinner.forPromise(observationsService.fetch($scope.patient.uuid, conceptNames, "latest", undefined, $scope.visitUuid, undefined).then(function (response) {
                $scope.observations = response.data;
            }));
        };

        return {
            restrict: 'E',
            link: link,
            template: '<ng-include src="contentUrl"/>'
        }
    }]).directive('customTreatmentChart', ['appService', 'treatmentConfig', 'TreatmentService', 'spinner', '$q', function (appService, treatmentConfig, treatmentService, spinner, $q) {
        var link = function ($scope) {
            var Constants = Bahmni.Clinical.Constants;
            var days = [
                'Sunday',
                'Monday',
                'Tuesday',
                'Wednesday',
                'Thursday',
                'Friday',
                'Saturday'
            ];
            $scope.contentUrl = appService.configBaseUrl() + "/customDisplayControl/views/customTreatmentChart.html";

            $scope.atLeastOneDrugForDay = function (day) {
                var atLeastOneDrugForDay = false;
                $scope.ipdDrugOrders.getIPDDrugs().forEach(function (drug) {
                    if (drug.isActiveOnDate(day.date)) {
                        atLeastOneDrugForDay = true;
                    }
                });
                return atLeastOneDrugForDay;
            };

            $scope.getVisitStopDateTime = function () {
                return $scope.visitSummary.stopDateTime || Bahmni.Common.Util.DateUtil.now();
            };

            $scope.getStatusOnDate = function (drug, date) {
                var activeDrugOrders = _.filter(drug.orders, function (order) {
                    if ($scope.config.frequenciesToBeHandled.indexOf(order.getFrequency()) !== -1) {
                        return getStatusBasedOnFrequency(order, date);
                    } else {
                        return drug.getStatusOnDate(date) === 'active';
                    }
                });
                if (activeDrugOrders.length === 0) {
                    return 'inactive';
                }
                if (_.every(activeDrugOrders, function (order) {
                    return order.getStatusOnDate(date) === 'stopped';
                })) {
                    return 'stopped';
                }
                return 'active';
            };

            var getStatusBasedOnFrequency = function (order, date) {
                var activeBetweenDate = order.isActiveOnDate(date);
                var frequencies = order.getFrequency().split(",").map(function (day) {
                    return day.trim();
                });
                var dayNumber = moment(date).day();
                return activeBetweenDate && frequencies.indexOf(days[dayNumber]) !== -1;
            };

            var init = function () {
                var getToDate = function () {
                    return $scope.visitSummary.stopDateTime || Bahmni.Common.Util.DateUtil.now();
                };

                var programConfig = appService.getAppDescriptor().getConfigValue("program") || {};

                var startDate = null, endDate = null, getEffectiveOrdersOnly = false;
                if (programConfig.showDetailsWithinDateRange) {
                    startDate = $stateParams.dateEnrolled;
                    endDate = $stateParams.dateCompleted;
                    if (startDate || endDate) {
                        $scope.config.showOtherActive = false;
                    }
                    getEffectiveOrdersOnly = true;
                }

                return $q.all([treatmentConfig(), treatmentService.getPrescribedAndActiveDrugOrders($scope.config.patientUuid, $scope.config.numberOfVisits,
                    $scope.config.showOtherActive, $scope.config.visitUuids || [], startDate, endDate, getEffectiveOrdersOnly)])
                    .then(function (results) {
                        var config = results[0];
                        var drugOrderResponse = results[1].data;
                        var createDrugOrderViewModel = function (drugOrder) {
                            return Bahmni.Clinical.DrugOrderViewModel.createFromContract(drugOrder, config);
                        };
                        for (var key in drugOrderResponse) {
                            drugOrderResponse[key] = drugOrderResponse[key].map(createDrugOrderViewModel);
                        }

                        var groupedByVisit = _.groupBy(drugOrderResponse.visitDrugOrders, function (drugOrder) {
                            return drugOrder.visit.startDateTime;
                        });
                        var treatmentSections = [];

                        for (var key in groupedByVisit) {
                            var values = Bahmni.Clinical.DrugOrder.Util.mergeContinuousTreatments(groupedByVisit[key]);
                            treatmentSections.push({ visitDate: key, drugOrders: values });
                        }
                        if (!_.isEmpty(drugOrderResponse[Constants.otherActiveDrugOrders])) {
                            var mergedOtherActiveDrugOrders = Bahmni.Clinical.DrugOrder.Util.mergeContinuousTreatments(drugOrderResponse[Constants.otherActiveDrugOrders]);
                            treatmentSections.push({
                                visitDate: Constants.otherActiveDrugOrders,
                                drugOrders: mergedOtherActiveDrugOrders
                            });
                        }
                        $scope.treatmentSections = treatmentSections;
                        if ($scope.visitSummary) {
                            $scope.ipdDrugOrders = Bahmni.Clinical.VisitDrugOrder.createFromDrugOrders(drugOrderResponse.visitDrugOrders, $scope.visitSummary.startDateTime, getToDate());
                        }
                    });
            };
            spinner.forPromise(init());
        };

        return {
            restrict: 'E',
            link: link,
            scope: {
                config: "=",
                visitSummary: '='
            },
            template: '<ng-include src="contentUrl"/>'
        }
    }]);