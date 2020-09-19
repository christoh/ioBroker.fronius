/**
 *
 *      ioBroker Fronius inverters Adapter
 *
 *      (c) 2017 ldittmar <iobroker@lmdsoft.de>
 *      (c) 2020 nkleber
 *
 *      MIT License
 * 
 *  changes:
 *  19.09.2020, nkleber:
 *      Modified creating and filling objects in a way that this will happen mostly dynamic.
 *      So if a object is not predefined, it will created with default settings and filled
 *
 */

/* global __dirname */
/* jshint -W097 */// jshint strict:false
/*jslint node: true */
"use strict";

// you have to require the utils module and call adapter function
const utils = require('@iobroker/adapter-core'); // Get common adapter utils

const request = require('request');
const ping = require(__dirname + '/lib/ping');

let ip, baseurl, apiver, requestType;
let isConnected = null;
let isObjectsCreated = false


// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.template.0
let adapter;
function startAdapter(options) {
    isObjectsCreated = false // create missing objects if necessary only on start
    options = options || {};
    Object.assign(options, {
        name: 'fronius',
        undload: function (callback) {
            // is called when adapter shuts down - callback has to be called under any circumstances!
            try {
                adapter.log.info('cleaned everything up...');
                callback();
            } catch (e) {
                callback();
            }
        },
        objectChange: function (id, obj) {
            // is called if a subscribed object changes
            adapter.log.info('objectChange ' + id + ' ' + JSON.stringify(obj));
        },
        stateChange: function (id, state) {
            // is called if a subscribed state changes
            // Warning, state can be null if it was deleted
            adapter.log.info('stateChange ' + id + ' ' + JSON.stringify(state));

            // you can use the ack flag to detect if it is status (true) or command (false)
            if (state && !state.ack) {
                adapter.log.info('ack is not set!');
            }
        },
        message: function (obj) {
            // Some message was sent to adapter instance over message box. Used by email, pushover, text2speech, ...
            let wait = false;
            if (obj) {
                switch (obj.command) {
                    case 'checkIP':
                        checkIP(obj.message, function (res) {
                            if (obj.callback)
                                adapter.sendTo(obj.from, obj.command, JSON.stringify(res), obj.callback);
                        });
                        wait = true;
                        break;
                    case 'getDeviceInfo':
                        getActiveDeviceInfo("System", obj.message, function (res) {
                            if (obj.callback)
                                adapter.sendTo(obj.from, obj.command, JSON.stringify(res), obj.callback);
                        });
                        wait = true;
                        break;
                    case 'getDeviceInfoInverter':
                        getActiveDeviceInfo("Inverter", obj.message, function (res) {
                            if (obj.callback)
                                adapter.sendTo(obj.from, obj.command, JSON.stringify(res), obj.callback);
                        });
                        wait = true;
                        break;
                    case 'getDeviceInfoSensor':
                        getActiveDeviceInfo("SensorCard", obj.message, function (res) {
                            if (obj.callback)
                                adapter.sendTo(obj.from, obj.command, JSON.stringify(res), obj.callback);
                        });
                        wait = true;
                        break;
                    case 'getDeviceInfoString':
                        getActiveDeviceInfo("StringControl", obj.message, function (res) {
                            if (obj.callback)
                                adapter.sendTo(obj.from, obj.command, JSON.stringify(res), obj.callback);
                        });
                        wait = true;
                        break;
                    default:
                        adapter.log.warn("Unknown command: " + obj.command);
                        break;
                }
            }
            if (!wait && obj.callback) {
                adapter.sendTo(obj.from, obj.command, obj.message, obj.callback);
            }
            return true;
        },
        ready: main
    });
    adapter = new utils.Adapter(options);

    return adapter;
}

//Check if IP is a Fronius inverter
function checkIP(ipToCheck, callback) {
    request.get(requestType + ipToCheck + '/solar_api/GetAPIVersion.cgi', function (error, response, body) {
        try {
            const testData = JSON.parse(body);
            if (!error && response.statusCode == 200 && 'BaseURL' in testData) {
                callback({error: 0, message: testData});
            } else {
                adapter.log.error("IP invalid");
                callback({error: 1, message: {}});
            }
        } catch (e) {
            adapter.log.error("IP is not a Fronis inverter");
            callback({error: 1, message: {}});
        }
    });
}

//Check Fronius devices v1
function getActiveDeviceInfo(type, url, callback) {
    request.get(requestType + url + 'GetActiveDeviceInfo.cgi?DeviceClass=' + type, function (error, response, body) {
        try {
            const deviceData = JSON.parse(body);
            if (!error && response.statusCode == 200 && 'Body' in deviceData) {
                callback({error: 0, message: deviceData.Body.Data});
            } else {
                adapter.log.warn(deviceData.Head.Status.Reason);
                callback({error: 1, message: {}});
            }
        } catch (e) {
            callback({error: 1, message: {}});
        }
    });
}

function createInverterObjects(id,obj) {
    if(isObjectsCreated){
        return
    }
    adapter.setObjectNotExists('inverter.' + id, {
        type: 'channel',
        common: {
            name: "inverter with device ID " + id,
            role: "info"
        },
        native: {}
    });
    if(obj.hasOwnProperty("DAY_ENERGY")){
        adapter.setObjectNotExists('inverter.' + id + '.DAY_ENERGY', {
            type: 'state',
            common: {
                name: "day energy",
                type: "number",
                role: "value",
                unit: "Wh",
                read: true,
                write: false,
                desc: "Energy generated on current day"
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("FAC")){
        adapter.setObjectNotExists('inverter.' + id + '.FAC', {
            type: 'state',
            common: {
                name: "FAC",
                type: "number",
                role: "value",
                unit: "Hz",
                read: true,
                write: false,
                desc: "AC frequency"
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("IAC")){
        adapter.setObjectNotExists('inverter.' + id + '.IAC', {
            type: "state",
            common: {
                name: "IAC",
                type: "number",
                role: "value",
                unit: "A",
                read: true,
                write: false,
                desc: "AC current"
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("IDC")){
        adapter.setObjectNotExists('inverter.' + id + '.IDC', {
            type: "state",
            common: {
                name: "IDC",
                type: "number",
                role: "value",
                unit: "A",
                read: true,
                write: false,
                desc: "DC current"
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("PAC")){
        adapter.setObjectNotExists('inverter.' + id + '.PAC', {
            type: "state",
            common: {
                name: "PAC",
                type: "number",
                role: "value",
                unit: "W",
                read: true,
                write: false,
                desc: "AC power"
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("SAC")){
        adapter.setObjectNotExists('inverter.' + id + '.SAC', {
            type: "state",
            common: {
                name: "Apparent power",
                type: "number",
                role: "value",
                unit: "VA",
                read: true,
                write: false,
                desc: "Apparent power"
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("TOTAL_ENERGY")){
        adapter.setObjectNotExists('inverter.' + id + '.TOTAL_ENERGY', {
            type: "state",
            common: {
                name: "total energy",
                type: "number",
                role: "value",
                unit: "Wh",
                read: true,
                write: false,
                desc: "Energy generated overall"
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("UAC")){
        adapter.setObjectNotExists('inverter.' + id + '.UAC', {
            type: "state",
            common: {
                name: "UAC",
                type: "number",
                role: "value",
                unit: "V",
                read: true,
                write: false,
                desc: "AC voltage"
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("UDC")){
        adapter.setObjectNotExists('inverter.' + id + '.UDC', {
            type: "state",
            common: {
                name: "UDC",
                type: "number",
                role: "value",
                unit: "V",
                read: true,
                write: false,
                desc: "DC voltage"
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("YEAR_ENERGY")){
        adapter.setObjectNotExists('inverter.' + id + '.YEAR_ENERGY', {
            type: "state",
            common: {
                name: "year energy",
                type: "number",
                role: "value",
                unit: "Wh",
                read: true,
                write: false,
                desc: "Energy generated in current year"
            },
            native: {}
        });
    }
    adapter.setObjectNotExists('inverter.' + id + '.StatusCode', {
        type: "state",
        common: {
            name: "status code",
            type: "number",
            role: "value",
            read: true,
            write: false,
            desc: "Status code for the inverter"
        },
        native: {}
    });
    adapter.setObjectNotExists('inverter.' + id + '.StatusCodeString', {
        type: "state",
        common: {
            name: "status code",
            type: "string",
            role: "value",
            read: true,
            write: false,
            desc: "Meaning of numerical status codes for the inverter"
        },
        native: {}
    });
    adapter.setObjectNotExists('inverter.' + id + '.ErrorCode', {
        type: "state",
        common: {
            name: "error code",
            type: "number",
            role: "value",
            read: true,
            write: false,
            desc: "Error code for the inverter"
        },
        native: {}
    });
    adapter.setObjectNotExists('inverter.' + id + '.ErrorCodeString', {
        type: "state",
        common: {
            name: "error code",
            type: "string",
            role: "value",
            read: true,
            write: false,
            desc: "Meaning of numerical error codes for the inverter"
        },
        native: {}
    });

    // wait a bit for creating the previous objects before creating the fallback once
    setTimeout(function(){
        adapter.log.debug("Fallback Missing Inverter Objects started")
        // fallback for not predefined parameters -> defined as number without unit
        for (var para in obj){
            adapter.setObjectNotExists('inverter.' + id + '.' + para.toString(), {
                type: "state",
                common: {
                    name: para.toString(),
                    type: "mixed",
                    role: "value",
                    unit: "",
                    read: true,
                    write: false,
                    desc: para.toString()
                },
                native: {}
            });
        }
        adapter.log.debug("Fallback Missing Inverter Objects created!")
    },2000);
}

function getStringErrorCode100(errorcode) {
    switch (errorcode) {
        case 102:
            return "AC voltage too high";
        case 103:
            return "AC voltage too low";
        case 105:
            return "AC frequency too high";
        case 106:
            return "AC frequency too low";
        case 107:
            return "AC grid outside the permissible limits";
        case 108:
            return "Stand alone operation detected";
        default:
            return "";
    }
}

function getStringErrorCode300(errorcode) {
    switch (errorcode) {
        case 301:
            return "Overcurrent (AC)";
        case 302:
            return "Overcurrent (DC)";
        case 303:
            return "DC module over temperature";
        case 304:
            return "AC module over temperature";
        case 305:
            return "No power being fed in, despite closed relay";
        case 306:
            return "PV output too low for feeding energy into the grid";
        case 307:
            return "LOW PV VOLTAGE! DC input voltage too low for feeding energy into the grid";
        case 308:
            return "Intermediate circuit voltage too high";
        case 309:
            return "DC input voltage MPPT 1 too high";
        case 311:
            return "Polarity of DC strings reversed";
        case 313:
            return "DC input voltage MPPT 2 too high";
        case 314:
            return "Current sensor calibration timeout";
        case 315:
            return "AC current sensor error";
        case 316:
            return "Interrupt Check fail";
        case 325:
            return "Overtemperature in the connection area";
        case 326:
            return "Fan 1 error";
        case 327:
            return "Fan 2 error";
        default:
            return "";
    }
}

function getStringErrorCode400(errorcode) {
    switch (errorcode) {
        case 401:
            return "No communication possible with the power stage set";
        case 406:
            return "AC module temperature sensor faulty (L1)";
        case 407:
            return "AC module temperature sensor faulty (L2)";
        case 408:
            return "DC component measured in the grid too high";
        case 412:
            return "Fixed voltage mode has been selected instead of MPP voltage mode and the fixed voltage has been set to too low or too high a value";
        case 415:
            return "Safety cut out via option card or RECERBO has triggered";
        case 416:
            return "No communication possible between power stage set and control system";
        case 417:
            return "Hardware ID problem";
        case 419:
            return "Unique ID conflict";
        case 420:
            return "No communication possible with the Hybrid manager";
        case 421:
            return "HID range error";
        case 425:
            return "No communication with the power stage set possible";
        case 426:
        case 427:
        case 428:
            return "Possible hardware fault";
        case 431:
            return "Software problem";
        case 436:
            return "Functional incompatibility (one or more PC boards in the inverter are not compatible with each other, e.g. after a PC board has been replaced.";
        case 437:
            return "Power stage set problem";
        case 438:
            return "Functional incompatibility (one or more PC boards in the inverter in the inverter are not compatible with each other, e.g. after a PC board has been replaced)";
        case 443:
            return "Intermediate circuit voltage too low or asymmetric";
        case 445:
            return "– Compatability error (e.g. due to replacement of a PC board) – invalid power stage set configuration";
        case 447:
            return "Insulation fault";
        case 448:
            return "Neutral conductor not connected";
        case 450:
            return "Guard cannot be found";
        case 451:
            return "Memory error detected";
        case 452:
            return "Communication error between the processors";
        case 453:
            return "Grid voltage and power stage set are incompatible";
        case 454:
            return "Grid frequency and power stage set are incompatible";
        case 456:
            return "Anti-islanding function is no longer implemented correctly";
        case 457:
            return "Grid relay sticking or the neutral conductor ground voltage is too high";
        case 458:
            return "Error when recording the measuring signal";
        case 459:
            return "Error when recording the measuring signal for the insulation test";
        case 460:
            return "Reference voltage source for the digital signal processor (DSP) is working out of tolerance";
        case 461:
            return "Fault in the DSP data memory";
        case 462:
            return "Error with DC feed monitoring routine";
        case 463:
            return "Reversed AC polarity, AC connector inserted incorrectly";
        case 474:
            return "RCMU sensor faulty";
        case 475:
            return "Solar panel ground fault, insulation fault (connection between solar panel and ground)";
        case 476:
            return "Driver supply voltage too low";
        case 480:
        case 481:
            return "Functional incompatibility (one or more PC boards in the inverter are not compatible with each other, e.g. after a PC board has been replaced)";
        case 482:
            return "Setup after the initial start-up was interrupted";
        case 483:
            return "Voltage UDC fixed on MPP2 string out of limits";
        case 485:
            return "CAN transmit buffer is full";
        default:
            return "";
    }
}

function getStringErrorCode500(errorcode) {
    switch (errorcode) {
        case 502:
            return "Insulation error on the solar panels";
        case 509:
            return "No energy fed into the grid in the past 24 hours";
        case 515:
            return "No communication with filter possible";
        case 516:
            return "No communication possible with the storage unit";
        case 517:
            return "Power derating caused by too high a temperature";
        case 518:
            return "Internal DSP malfunction";
        case 519:
            return "No communication possible with the storage unit";
        case 520:
            return "No energy fed into the grid by MPPT1 in the past 24 hours";
        case 522:
            return "DC low string 1";
        case 523:
            return "DC low string 2";
        case 558:
        case 559:
            return "Functional incompatibility (one or more PC boards in the inverter are not compatible with each other, e.g. after a PC board has been replaced)";
        case 560:
            return "Derating caused by over-frequency";
        case 564:
            return "Functional incompatibility (one or more PC boards in the inverter are not compatible with each other, e.g. after a PC board has been replaced)";
        case 566:
            return "Arc detector switched off (e.g. during external arc monitoring)";
        case 567:
            return "Grid Voltage Dependent Power Reduction is active";
        default:
            return "";
    }
}

function getStringErrorCode600(errorcode) {
    switch (errorcode) {
        case 601:
            return "CAN bus is full";
        case 603:
            return "AC module temperature sensor faulty (L3)";
        case 604:
            return "DC module temperature sensor faulty";
        case 607:
            return "RCMU error";
        case 608:
            return "Functional incompatibility (one or more PC boards in the inverter are not compatible with each other, e.g. after a PC board has been replaced)";
        default:
            return "";
    }
}

function getStringErrorCode700(errorcode) {
    switch (errorcode) {
        case 701:
        case 702:
        case 703:
        case 704:
        case 705:
        case 706:
        case 707:
        case 708:
        case 709:
        case 710:
        case 711:
        case 712:
        case 713:
        case 714:
        case 715:
        case 716:
            return "Provides information about the internal processor status";
        case 721:
            return "EEPROM has been reinitialised";
        case 722:
        case 723:
        case 724:
        case 725:
        case 726:
        case 727:
        case 728:
        case 729:
        case 730:
            return "Provides information about the internal processor status";
        case 731:
            return "Initialisation error – USB flash drive is not supported";
        case 732:
            return "Initialisation erro – Over current on USB stick";
        case 733:
            return "No USB flash drive connected";
        case 734:
            return "Update file not recognised or not present";
        case 735:
            return "Update file does not match the device, update file too old";
        case 736:
            return "Write or read error occurred";
        case 737:
            return "File could not be opened";
        case 738:
            return "Log file cannot be saved (e.g. USB flash drive is write protected or full)";
        case 740:
            return "Initialisation error-error in file system on USB flash drive";
        case 741:
            return "Error during recording of logging data";
        case 743:
            return "Error occurred during update process";
        case 745:
            return "Update file corrupt";
        case 746:
            return "Error occurred during update process";
        case 751:
            return "Time lost";
        case 752:
            return "Real Time Clock module communication error";
        case 753:
            return "Internal error: Real Time Clock module is in emergency mode";
        case 754:
        case 755:
            return "Provides information about the processor status";
        case 757:
            return "Hardware error in the Real Time Clock module";
        case 758:
            return "Internal error: Real Time Clock module is in emergency mode";
        case 760:
            return "Internal hardware error";
        case 761:
        case 762:
        case 763:
        case 764:
        case 765:
            return "Provides information about the internal processor status";
        case 766:
            return "Emergency power de-rating has been activated";
        case 767:
            return "Provides information about the internal processor status";
        case 768:
            return "Different power limitation in the hardware modules";
        case 772:
            return "Storage unit not available";
        case 773:
            return "Software update group 0 (invalid country setup)";
        case 775:
            return "PMC power stage set not available";
        case 776:
            return "Invalid device type";
        case 781:
        case 782:
        case 783:
        case 784:
        case 785:
        case 786:
        case 787:
        case 788:
        case 789:
        case 790:
        case 791:
        case 792:
        case 793:
        case 794:
            return "Provides information about the internal processor status";
        default:
            return "";
    }
}

//Get Infos from Inverter
function getInverterRealtimeData(id) {
    // fallback if no id set
    if(id == ""){
        id = 0;
    }
    request.get(requestType + ip + baseurl + 'GetInverterRealtimeData.cgi?Scope=Device&DeviceId=' + id + '&DataCollection=CommonInverterData', function (error, response, body) {
        if (!error && response.statusCode == 200) {
            try {
                const data = JSON.parse(body);
                if ("Body" in data) {

                    const resp = data.Body.Data;
                    createInverterObjects(id,resp);

                    for (var par in resp){
                        adapter.setState("inverter." + id + "." + par.toString(), {val: resp[par.toString()].Value, ack: true});
                    }

                    const status = resp.DeviceStatus;
                    let statusCode = parseInt(status.StatusCode);
                    if(status){
                        adapter.setState("inverter." + id + ".DeviceStatus", {val: JSON.stringify(status), ack: true});
                    }
                    adapter.setState("inverter." + id + ".StatusCode", {val: statusCode, ack: true});

                    let statusCodeString = "Startup";
                    if (statusCode === 7) {
                        statusCodeString = "Running";
                    } else if (statusCode === 8) {
                        statusCodeString = "Standby";
                    } else if (statusCode === 9) {
                        statusCodeString = "Bootloading";
                    } else if (statusCode === 10) {
                        statusCodeString = "Error";
                    }
                    if(status.hasOwnProperty("InverterState")){
                        statusCodeString = status.InverterState;
                    }
                    adapter.setState("inverter." + id + ".StatusCodeString", {val: statusCodeString, ack: true});

                    statusCode = parseInt(status.ErrorCode);
                    adapter.setState("inverter." + id + ".ErrorCode", {val: statusCode, ack: true});

                    if (statusCode >= 700) {
                        statusCodeString = getStringErrorCode700(statusCode);
                    } else if (statusCode >= 600) {
                        statusCodeString = getStringErrorCode600(statusCode);
                    } else if (statusCode >= 500) {
                        statusCodeString = getStringErrorCode500(statusCode);
                    } else if (statusCode >= 400) {
                        statusCodeString = getStringErrorCode400(statusCode);
                    } else if (statusCode >= 300) {
                        statusCodeString = getStringErrorCode300(statusCode);
                    } else {
                        statusCodeString = getStringErrorCode100(statusCode);
                    }
                    adapter.setState("inverter." + id + ".ErrorCodeString", {val: statusCodeString, ack: true});

                } else {
                    adapter.log.warn(data.Head.Status.Reason + " inverter: " + id);
                }
            } catch (e) {
                adapter.log.warn(e);
            }
        }
    });
}

function createStorageObjects(id) {
    if(isObjectsCreated){
        return
    }
    adapter.setObjectNotExists('storage', {
        type: 'channel',
        common: {
            name: "detailed information about Storage devices",
            role: "info"
        },
        native: {}
    });
    adapter.setObjectNotExists('storage.' + id, {
        type: 'channel',
        common: {
            name: "storage with device ID " + id,
            role: "info"
        },
        native: {}
    });
    adapter.setObjectNotExists('storage.' + id + '.controller', {
        type: 'channel',
        common: {
            name: "controller",
            role: "info"
        },
        native: {}
    });
    adapter.setObjectNotExists('storage.' + id + '.controller.Model', {
        type: "state",
        common: {
            name: "ManufacturerModel Controller",
            type: "string",
            role: "value",
            read: true,
            write: false,
            desc: "Manufacturer & Model from controller"
        },
        native: {}
    });
    adapter.setObjectNotExists('storage.' + id + '.controller.Enable', {
        type: "state",
        common: {
            name: "enable",
            type: "boolean",
            role: "value",
            read: true,
            write: false,
            desc: "controller enabled"
        },
        native: {}
    });
    adapter.setObjectNotExists('storage.' + id + '.controller.StateOfCharge_Relative', {
        type: "state",
        common: {
            name: "State of charge",
            type: "number",
            role: "value",
            unit: "?",
            read: true,
            write: false,
            desc: "Realative state of charge"
        },
        native: {}
    });
    adapter.setObjectNotExists('storage.' + id + '.controller.Voltage_DC', {
        type: "state",
        common: {
            name: "Voltage DC",
            type: "number",
            role: "value",
            unit: "V",
            read: true,
            write: false,
            desc: "Voltage DC"
        },
        native: {}
    });
    adapter.setObjectNotExists('storage.' + id + '.controller.Current_DC', {
        type: "state",
        common: {
            name: "Current DC",
            type: "number",
            role: "value",
            unit: "?",
            read: true,
            write: false,
            desc: "Current DC"
        },
        native: {}
    });
    adapter.setObjectNotExists('storage.' + id + '.controller.Temperature_Cell', {
        type: "state",
        common: {
            name: "Cell temperature",
            type: "number",
            role: "value",
            unit: "°C",
            read: true,
            write: false,
            desc: "Cell temperature"
        },
        native: {}
    });
    adapter.setObjectNotExists('storage.' + id + '.controller.Voltage_DC_Maximum_Cell', {
        type: "state",
        common: {
            name: "Voltage DC Maximum Cell",
            type: "number",
            role: "value",
            unit: "?",
            read: true,
            write: false,
            desc: "Voltage DC Maximum Cell"
        },
        native: {}
    });
    adapter.setObjectNotExists('storage.' + id + '.controller.Voltage_DC_Minimum_Cell', {
        type: "state",
        common: {
            name: "Voltage DC Minimum Cell",
            type: "number",
            role: "value",
            unit: "?",
            read: true,
            write: false,
            desc: "Voltage DC Minimum Cell"
        },
        native: {}
    });
    adapter.setObjectNotExists('storage.' + id + '.controller.DesignedCapacity', {
        type: "state",
        common: {
            name: "Designed capacity",
            type: "number",
            role: "value",
            unit: "W",
            read: true,
            write: false,
            desc: "Designed capacity"
        },
        native: {}
    });

}

function getStorageRealtimeData(id) {
    request.get(requestType + ip + baseurl + 'GetStorageRealtimeData.cgi?Scope=Device&DeviceId=' + id, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            try {
                const data = JSON.parse(body);
                if ("Body" in data) {

                    createStorageObjects(id);

                    const resp = data.Body.Data.Controller;

                    adapter.setState("storage." + id + ".controller.Model", {val: resp.Details.Manufacturer + ' ' + resp.Details.Model, ack: true});
                    adapter.setState("storage." + id + ".controller.Enable", {val: resp.Enable === '1', ack: true});
                    adapter.setState("storage." + id + ".controller.StateOfCharge_Relative", {val: resp.StateOfCharge_Relative, ack: true});
                    adapter.setState("storage." + id + ".controller.Voltage_DC", {val: resp.Voltage_DC, ack: true});
                    adapter.setState("storage." + id + ".controller.Current_DC", {val: resp.Current_DC, ack: true});
                    adapter.setState("storage." + id + ".controller.Temperature_Cell", {val: resp.Temperature_Cell, ack: true});
                    adapter.setState("storage." + id + ".controller.Voltage_DC_Maximum_Cell", {val: resp.Voltage_DC_Maximum_Cell, ack: true});
                    adapter.setState("storage." + id + ".controller.Voltage_DC_Minimum_Cell", {val: resp.Voltage_DC_Minimum_Cell, ack: true});
                    adapter.setState("storage." + id + ".controller.DesignedCapacity", {val: resp.DesignedCapacity, ack: true});


                } else {
                    adapter.log.warn(data.Head.Status.Reason + " storage: " + id);
                }
            } catch (e) {
                adapter.log.warn(e);
            }
        }
    });
}

function createMeterObjects(id,obj) {

    if(isObjectsCreated){
        return
    }

    adapter.log.debug("Creating missed MeterObjects...")
    adapter.setObjectNotExists('meter', {
        type: 'channel',
        common: {
            name: "detailed information about Meter devices",
            role: "info"
        },
        native: {}
    });
    adapter.setObjectNotExists('meter.' + id, {
        type: 'channel',
        common: {
            name: "meter with device ID " + id,
            role: "info"
        },
        native: {}
    });
    adapter.setObjectNotExists('meter.' + id + '.Model', {
        type: "state",
        common: {
            name: "ManufacturerModel",
            type: "string",
            role: "value",
            read: true,
            write: false,
            desc: "Manufacturer & Model"
        },
        native: {}
    });
    if(obj.hasOwnProperty("PowerReal_P_Sum")){
        adapter.setObjectNotExists('meter.' + id + '.PowerReal_P_Sum', {
            type: "state",
            common: {
                name: "current power",
                type: "number",
                role: "value",
                unit: "W",
                read: true,
                write: false,
                desc: "current total power"
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("PowerReal_P_Phase_1")){
        adapter.setObjectNotExists('meter.' + id + '.PowerReal_P_Phase_1', {
            type: "state",
            common: {
                name: "PowerReal_P_Phase_1",
                type: "number",
                role: "value",
                unit: "W",
                read: true,
                write: false,
                desc: ""
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("PowerReal_P_Phase_2")){
        adapter.setObjectNotExists('meter.' + id + '.PowerReal_P_Phase_2', {
            type: "state",
            common: {
                name: "PowerReal_P_Phase_2",
                type: "number",
                role: "value",
                unit: "W",
                read: true,
                write: false,
                desc: ""
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("PowerReal_P_Phase_3")){
        adapter.setObjectNotExists('meter.' + id + '.PowerReal_P_Phase_3', {
            type: "state",
            common: {
                name: "PowerReal_P_Phase_3",
                type: "number",
                role: "value",
                unit: "W",
                read: true,
                write: false,
                desc: ""
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("PowerReactive_Q_Sum")){
        adapter.setObjectNotExists('meter.' + id + '.PowerReactive_Q_Sum', {
            type: "state",
            common: {
                name: "REACTIVE Power total",
                type: "number",
                role: "value",
                unit: "VAr",
                read: true,
                write: false,
                desc: ""
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("SMARTMETER_POWERREACTIVE_MEAN_SUM_F64")){
        adapter.setObjectNotExists('meter.' + id + '.SMARTMETER_POWERREACTIVE_MEAN_SUM_F64',{
          type: "state",
          common: {
            name: "REACTIVE Power total",
            type: "number",
            role: "value",
            unit: "VAr",
            read: true,
            write: false,
            desc: "SMARTMETER_POWERREACTIVE_MEAN_SUM_F64"
          },
          native: {}
        });
      }
    if(obj.hasOwnProperty("PowerReactive_Q_Phase_1")){
        adapter.setObjectNotExists('meter.' + id + '.PowerReactive_Q_Phase_1', {
            type: "state",
            common: {
                name: "REACTIVE Power L1",
                type: "number",
                role: "value",
                unit: "VAr",
                read: true,
                write: false,
                desc: ""
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("SMARTMETER_POWERREACTIVE_01_F64")){
        adapter.setObjectNotExists('meter.' + id + '.SMARTMETER_POWERREACTIVE_01_F64',{
          type: "state",
          common: {
            name: "REACTIVE Power L1",
            type: "number",
            role: "value",
            unit: "VAr",
            read: true,
            write: false,
            desc: "SMARTMETER_POWERREACTIVE_01_F64"
          },
          native: {}
        });
      }
    if(obj.hasOwnProperty("PowerReactive_Q_Phase_2")){
        adapter.setObjectNotExists('meter.' + id + '.PowerReactive_Q_Phase_2', {
            type: "state",
            common: {
                name: "REACTIVE Power L2",
                type: "number",
                role: "value",
                unit: "VAr",
                read: true,
                write: false,
                desc: ""
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("SMARTMETER_POWERREACTIVE_02_F64")){
        adapter.setObjectNotExists('meter.' + id + '.SMARTMETER_POWERREACTIVE_02_F64',{
          type: "state",
          common: {
            name: "REACTIVE Power L2",
            type: "number",
            role: "value",
            unit: "VAr",
            read: true,
            write: false,
            desc: "SMARTMETER_POWERREACTIVE_02_F64"
          },
          native: {}
        });
      }
    if(obj.hasOwnProperty("PowerReactive_Q_Phase_3")){
        adapter.setObjectNotExists('meter.' + id + '.PowerReactive_Q_Phase_3', {
            type: "state",
            common: {
                name: "REACTIVE Power L3",
                type: "number",
                role: "value",
                unit: "VAr",
                read: true,
                write: false,
                desc: ""
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("SMARTMETER_POWERREACTIVE_03_F64")){
        adapter.setObjectNotExists('meter.' + id + '.SMARTMETER_POWERREACTIVE_03_F64',{
          type: "state",
          common: {
            name: "REACTIVE Power L3",
            type: "number",
            role: "value",
            unit: "VAr",
            read: true,
            write: false,
            desc: "SMARTMETER_POWERREACTIVE_03_F64"
          },
          native: {}
        });
      }
    if(obj.hasOwnProperty("Current_AC_Phase_1")){
        adapter.setObjectNotExists('meter.' + id + '.Current_AC_Phase_1', {
            type: "state",
            common: {
                name: "AC current L1",
                type: "number",
                role: "value",
                unit: "A",
                read: true,
                write: false,
                desc: ""
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("ACBRIDGE_CURRENT_ACTIVE_MEAN_01_F32")){
        adapter.setObjectNotExists('meter.' + id + '.ACBRIDGE_CURRENT_ACTIVE_MEAN_01_F32',{
          type: "state",
          common: {
            name: "AVG AC current L1",
            type: "number",
            role: "value",
            unit: "A",
            read: true,
            write: false,
            desc: "ACBRIDGE_CURRENT_ACTIVE_MEAN_01_F32"
          },
          native: {}
        });
      }
    if(obj.hasOwnProperty("Current_AC_Phase_2")){
        adapter.setObjectNotExists('meter.' + id + '.Current_AC_Phase_2', {
            type: "state",
            common: {
                name: "AC current L2",
                type: "number",
                role: "value",
                unit: "A",
                read: true,
                write: false,
                desc: ""
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("ACBRIDGE_CURRENT_ACTIVE_MEAN_02_F32")){
        adapter.setObjectNotExists('meter.' + id + '.ACBRIDGE_CURRENT_ACTIVE_MEAN_02_F32',{
          type: "state",
          common: {
            name: "AVG AC current L2",
            type: "number",
            role: "value",
            unit: "A",
            read: true,
            write: false,
            desc: "ACBRIDGE_CURRENT_ACTIVE_MEAN_02_F32"
          },
          native: {}
        });
      }
    if(obj.hasOwnProperty("Current_AC_Phase_3")){
        adapter.setObjectNotExists('meter.' + id + '.Current_AC_Phase_3', {
            type: "state",
            common: {
                name: "AC current L3",
                type: "number",
                role: "value",
                unit: "A",
                read: true,
                write: false,
                desc: ""
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("ACBRIDGE_CURRENT_ACTIVE_MEAN_03_F32")){
        adapter.setObjectNotExists('meter.' + id + '.ACBRIDGE_CURRENT_ACTIVE_MEAN_03_F32',{
          type: "state",
          common: {
            name: "AVG AC current L3",
            type: "number",
            role: "value",
            unit: "A",
            read: true,
            write: false,
            desc: "ACBRIDGE_CURRENT_ACTIVE_MEAN_03_F32"
          },
          native: {}
        });
      }
    if(obj.hasOwnProperty("Voltage_AC_Phase_1")){
        adapter.setObjectNotExists('meter.' + id + '.Voltage_AC_Phase_1', {
            type: "state",
            common: {
                name: "AC VOLTAGE L1",
                type: "number",
                role: "value",
                unit: "V",
                read: true,
                write: false,
                desc: ""
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("SMARTMETER_VOLTAGE_01_F64")){
        adapter.setObjectNotExists('meter.' + id + '.SMARTMETER_VOLTAGE_01_F64',{
          type: "state",
          common: {
            name: "AC VOLTAGE L1",
            type: "number",
            role: "value",
            unit: "V",
            read: true,
            write: false,
            desc: "SMARTMETER_VOLTAGE_01_F64"
          },
          native: {}
        });
    }
    if(obj.hasOwnProperty("SMARTMETER_VOLTAGE_MEAN_01_F64")){
        adapter.setObjectNotExists('meter.' + id + '.SMARTMETER_VOLTAGE_MEAN_01_F64',{
          type: "state",
          common: {
            name: "AVG AC VOLTAGE L1",
            type: "number",
            role: "value",
            unit: "V",
            read: true,
            write: false,
            desc: "SMARTMETER_VOLTAGE_MEAN_01_F64"
          },
          native: {}
        });
    }
    if(obj.hasOwnProperty("Voltage_AC_Phase_2")){
        adapter.setObjectNotExists('meter.' + id + '.Voltage_AC_Phase_2', {
            type: "state",
            common: {
                name: "AC VOLTAGE L2",
                type: "number",
                role: "value",
                unit: "V",
                read: true,
                write: false,
                desc: ""
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("SMARTMETER_VOLTAGE_02_F64")){
        adapter.setObjectNotExists('meter.' + id + '.SMARTMETER_VOLTAGE_02_F64',{
          type: "state",
          common: {
            name: "AC VOLTAGE L2",
            type: "number",
            role: "value",
            unit: "V",
            read: true,
            write: false,
            desc: "SMARTMETER_VOLTAGE_02_F64"
          },
          native: {}
        });
    }
    if(obj.hasOwnProperty("SMARTMETER_VOLTAGE_MEAN_02_F64")){
        adapter.setObjectNotExists('meter.' + id + '.SMARTMETER_VOLTAGE_MEAN_02_F64',{
          type: "state",
          common: {
            name: "AVG AC VOLTAGE L2",
            type: "number",
            role: "value",
            unit: "V",
            read: true,
            write: false,
            desc: "SMARTMETER_VOLTAGE_MEAN_02_F64"
          },
          native: {}
        });
    }
    if(obj.hasOwnProperty("Voltage_AC_Phase_3")){
        adapter.setObjectNotExists('meter.' + id + '.Voltage_AC_Phase_3', {
            type: "state",
            common: {
                name: "AC VOLTAGE L3",
                type: "number",
                role: "value",
                unit: "V",
                read: true,
                write: false,
                desc: ""
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("SMARTMETER_VOLTAGE_03_F64")){
        adapter.setObjectNotExists('meter.' + id + '.SMARTMETER_VOLTAGE_03_F64',{
          type: "state",
          common: {
            name: "AC VOLTAGE L3",
            type: "number",
            role: "value",
            unit: "V",
            read: true,
            write: false,
            desc: "SMARTMETER_VOLTAGE_03_F64"
          },
          native: {}
        });
      }
    if(obj.hasOwnProperty("SMARTMETER_VOLTAGE_MEAN_03_F64")){
        adapter.setObjectNotExists('meter.' + id + '.SMARTMETER_VOLTAGE_MEAN_03_F64',{
            type: "state",
            common: {
            name: "AVG AC VOLTAGE L3",
            type: "number",
            role: "value",
            unit: "V",
            read: true,
            write: false,
            desc: "SMARTMETER_VOLTAGE_MEAN_03_F64"
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("Voltage_AC_PhaseToPhase_12")){
        adapter.setObjectNotExists('meter.' + id + '.Voltage_AC_PhaseToPhase_12', {
            type: "state",
            common: {
                name: "Voltage_AC_PhaseToPhase_12",
                type: "number",
                role: "value",
                unit: "V",
                read: true,
                write: false,
                desc: ""
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("ACBRIDGE_VOLTAGE_MEAN_12_F32")){
        adapter.setObjectNotExists('meter.' + id + '.ACBRIDGE_VOLTAGE_MEAN_12_F32',{
          type: "state",
          common: {
            name: "AVG AC voltage L1-L2",
            type: "number",
            role: "value",
            unit: "V",
            read: true,
            write: false,
            desc: "ACBRIDGE_VOLTAGE_MEAN_12_F32"
          },
          native: {}
        });
    }
    if(obj.hasOwnProperty("Voltage_AC_PhaseToPhase_23")){
        adapter.setObjectNotExists('meter.' + id + '.Voltage_AC_PhaseToPhase_23', {
            type: "state",
            common: {
                name: "Voltage_AC_PhaseToPhase_23",
                type: "number",
                role: "value",
                unit: "V",
                read: true,
                write: false,
                desc: ""
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("ACBRIDGE_VOLTAGE_MEAN_23_F32")){
        adapter.setObjectNotExists('meter.' + id + '.ACBRIDGE_VOLTAGE_MEAN_23_F32',{
          type: "state",
          common: {
            name: "AVG AC voltage L2-L3",
            type: "number",
            role: "value",
            unit: "V",
            read: true,
            write: false,
            desc: "ACBRIDGE_VOLTAGE_MEAN_23_F32"
          },
          native: {}
        });
    }
    if(obj.hasOwnProperty("Voltage_AC_PhaseToPhase_31")){
        adapter.setObjectNotExists('meter.' + id + '.Voltage_AC_PhaseToPhase_31', {
            type: "state",
            common: {
                name: "Voltage_AC_PhaseToPhase_31",
                type: "number",
                role: "value",
                unit: "V",
                read: true,
                write: false,
                desc: ""
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("ACBRIDGE_VOLTAGE_MEAN_31_F32")){
        adapter.setObjectNotExists('meter.' + id + '.ACBRIDGE_VOLTAGE_MEAN_31_F32',{
          type: "state",
          common: {
            name: "AVG AC voltage L3-L1",
            type: "number",
            role: "value",
            unit: "V",
            read: true,
            write: false,
            desc: "ACBRIDGE_VOLTAGE_MEAN_31_F32"
          },
          native: {}
        });
      }
    if(obj.hasOwnProperty("Frequency_Phase_Average")){
        adapter.setObjectNotExists('meter.' + id + '.Frequency_Phase_Average', {
            type: "state",
            common: {
                name: "AVG GRID FREQUENCY",
                type: "number",
                role: "value",
                unit: "HZ",
                read: true,
                write: false,
                desc: ""
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("GRID_FREQUENCY_MEAN_F32")){
        adapter.setObjectNotExists('meter.' + id + '.GRID_FREQUENCY_MEAN_F32',{
          type: "state",
          common: {
            name: "AVG GRID FREQUENCY",
            type: "number",
            role: "value",
            unit: "Hz",
            read: true,
            write: false,
            desc: "GRID_FREQUENCY_MEAN_F32"
          },
          native: {}
        });
      }
    if(obj.hasOwnProperty("PowerApparent_S_Sum")){
        adapter.setObjectNotExists('meter.' + id + '.PowerApparent_S_Sum', {
            type: "state",
            common: {
                name: "APPARENT POWER total",
                type: "number",
                role: "value",
                unit: "VA",
                read: true,
                write: false,
                desc: ""
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("SMARTMETER_POWERAPPARENT_01_F64")){
        adapter.setObjectNotExists('meter.' + id + '.SMARTMETER_POWERAPPARENT_01_F64',{
          type: "state",
          common: {
            name: "APPARENT POWER L1",
            type: "number",
            role: "value",
            unit: "VA",
            read: true,
            write: false,
            desc: "SMARTMETER_POWERAPPARENT_01_F64"
          },
          native: {}
        });
      }
      if(obj.hasOwnProperty("SMARTMETER_POWERAPPARENT_02_F64")){
        adapter.setObjectNotExists('meter.' + id + '.SMARTMETER_POWERAPPARENT_02_F64',{
          type: "state",
          common: {
            name: "APPARENT POWER L2",
            type: "number",
            role: "value",
            unit: "VA",
            read: true,
            write: false,
            desc: "SMARTMETER_POWERAPPARENT_02_F64"
          },
          native: {}
        });
      }
    if(obj.hasOwnProperty("SMARTMETER_POWERAPPARENT_03_F64")){
      adapter.setObjectNotExists('meter.' + id + '.SMARTMETER_POWERAPPARENT_03_F64',{
        type: "state",
        common: {
          name: "APPARENT Power L3",
          type: "number",
          role: "value",
          unit: "VA",
          read: true,
          write: false,
          desc: "SMARTMETER_POWERAPPARENT_03_F64"
        },
        native: {}
      });
    }
    if(obj.hasOwnProperty("SMARTMETER_POWERAPPARENT_MEAN_01_F64")){
      adapter.setObjectNotExists('meter.' + id + '.SMARTMETER_POWERAPPARENT_MEAN_01_F64',{
        type: "state",
        common: {
          name: "AVG APPARENT Power L1",
          type: "number",
          role: "value",
          unit: "VA",
          read: true,
          write: false,
          desc: "SMARTMETER_POWERAPPARENT_MEAN_01_F64"
        },
        native: {}
      });
    }
    if(obj.hasOwnProperty("SMARTMETER_POWERAPPARENT_MEAN_02_F64")){
      adapter.setObjectNotExists('meter.' + id + '.SMARTMETER_POWERAPPARENT_MEAN_02_F64',{
        type: "state",
        common: {
          name: "AVG APPARENT Power L2",
          type: "number",
          role: "value",
          unit: "VA",
          read: true,
          write: false,
          desc: "SMARTMETER_POWERAPPARENT_MEAN_02_F64"
        },
        native: {}
      });
    }
    if(obj.hasOwnProperty("SMARTMETER_POWERAPPARENT_MEAN_03_F64")){
      adapter.setObjectNotExists('meter.' + id + '.SMARTMETER_POWERAPPARENT_MEAN_03_F64',{
        type: "state",
        common: {
          name: "AVG APPARENT Power L3",
          type: "number",
          role: "value",
          unit: "VA",
          read: true,
          write: false,
          desc: "SMARTMETER_POWERAPPARENT_MEAN_03_F64"
        },
        native: {}
      });
    }
    if(obj.hasOwnProperty("SMARTMETER_POWERAPPARENT_MEAN_SUM_F64")){
      adapter.setObjectNotExists('meter.' + id + '.SMARTMETER_POWERAPPARENT_MEAN_SUM_F64',{
        type: "state",
        common: {
          name: "AVG APPARENT Power total",
          type: "number",
          role: "value",
          unit: "VA",
          read: true,
          write: false,
          desc: "SMARTMETER_POWERAPPARENT_MEAN_SUM_F64"
        },
        native: {}
      });
    }
    if(obj.hasOwnProperty("PowerFactor_Sum")){
        adapter.setObjectNotExists('meter.' + id + '.PowerFactor_Sum', {
            type: "state",
            common: {
                name: "POWERFACTOR total",
                type: "number",
                role: "value",
                unit: "",
                read: true,
                write: false,
                desc: ""
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("SMARTMETER_FACTOR_POWER_SUM_F64")){
        adapter.setObjectNotExists('meter.' + id + '.SMARTMETER_FACTOR_POWER_SUM_F64',{
          type: "state",
          common: {
            name: "POWERFACTOR total",
            type: "number",
            role: "value",
            unit: "",
            read: true,
            write: false,
            desc: "SMARTMETER_FACTOR_POWER_SUM_F64"
          },
          native: {}
        });
    }
    if(obj.hasOwnProperty("PowerFactor_Phase_1")){
        adapter.setObjectNotExists('meter.' + id + '.PowerFactor_Phase_1', {
            type: "state",
            common: {
                name: "POWERFACTOR L1",
                type: "number",
                role: "value",
                unit: "",
                read: true,
                write: false,
                desc: ""
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("SMARTMETER_FACTOR_POWER_01_F64")){
        adapter.setObjectNotExists('meter.' + id + '.SMARTMETER_FACTOR_POWER_01_F64',{
          type: "state",
          common: {
            name: "POWERFACTOR L1",
            type: "number",
            role: "value",
            unit: "",
            read: true,
            write: false,
            desc: "SMARTMETER_FACTOR_POWER_01_F64"
          },
          native: {}
        });
    }
    if(obj.hasOwnProperty("PowerFactor_Phase_2")){
        adapter.setObjectNotExists('meter.' + id + '.PowerFactor_Phase_2', {
            type: "state",
            common: {
                name: "POWERFACTOR L2",
                type: "number",
                role: "value",
                unit: "",
                read: true,
                write: false,
                desc: ""
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("SMARTMETER_FACTOR_POWER_02_F64")){
        adapter.setObjectNotExists('meter.' + id + '.SMARTMETER_FACTOR_POWER_02_F64',{
          type: "state",
          common: {
            name: "POWERFACTOR L2",
            type: "number",
            role: "value",
            unit: "",
            read: true,
            write: false,
            desc: "SMARTMETER_FACTOR_POWER_02_F64"
          },
          native: {}
        });
    }
    if(obj.hasOwnProperty("PowerFactor_Phase_3")){
        adapter.setObjectNotExists('meter.' + id + '.PowerFactor_Phase_3', {
            type: "state",
            common: {
                name: "POWERFACTOR L3",
                type: "number",
                role: "value",
                unit: "",
                read: true,
                write: false,
                desc: ""
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("SMARTMETER_FACTOR_POWER_03_F64")){
        adapter.setObjectNotExists('meter.' + id + '.SMARTMETER_FACTOR_POWER_03_F64',{
          type: "state",
          common: {
            name: "POWERFACTOR L3",
            type: "number",
            role: "value",
            unit: "",
            read: true,
            write: false,
            desc: "SMARTMETER_FACTOR_POWER_03_F64"
          },
          native: {}
        });
    }
    if(obj.hasOwnProperty("EnergyReal_WAC_Sum_Produced")){
        adapter.setObjectNotExists('meter.' + id + '.EnergyReal_WAC_Sum_Produced', {
            type: "state",
            common: {
                name: "SUM ACTIVE ENERGY PRODUCED",
                type: "number",
                role: "value",
                unit: "Wh",
                read: true,
                write: false,
                desc: ""
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("SMARTMETER_ENERGYACTIVE_PRODUCED_SUM_F64")){
        adapter.setObjectNotExists('meter.' + id + '.SMARTMETER_ENERGYACTIVE_PRODUCED_SUM_F64',{
          type: "state",
          common: {
            name: "SUM ACTIVE ENERGY PRODUCED",
            type: "number",
            role: "value",
            unit: "Wh",
            read: true,
            write: false,
            desc: "SMARTMETER_ENERGYACTIVE_PRODUCED_SUM_F64"
          },
          native: {}
        });
      }
    if(obj.hasOwnProperty("EnergyReal_WAC_Sum_Consumed")){
        adapter.setObjectNotExists('meter.' + id + '.EnergyReal_WAC_Sum_Consumed', {
            type: "state",
            common: {
                name: "SUM ACTIVE ENERGY CONSUMED",
                type: "number",
                role: "value",
                unit: "Wh",
                read: true,
                write: false,
                desc: ""
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("SMARTMETER_ENERGYACTIVE_CONSUMED_SUM_F64")){
        adapter.setObjectNotExists('meter.' + id + '.SMARTMETER_ENERGYACTIVE_CONSUMED_SUM_F64',{
          type: "state",
          common: {
            name: "SUM ACTIVE ENERGY CONSUMED",
            type: "number",
            role: "value",
            unit: "Wh",
            read: true,
            write: false,
            desc: "SMARTMETER_ENERGYACTIVE_CONSUMED_SUM_F64"
          },
          native: {}
        });
    }
    if(obj.hasOwnProperty("EnergyReactive_VArAC_Sum_Produced")){
        adapter.setObjectNotExists('meter.' + id + '.EnergyReactive_VArAC_Sum_Produced', {
            type: "state",
            common: {
                name: "SUM REACTIVE ENERGY PRODUCED",
                type: "number",
                role: "value",
                unit: "VArh",
                read: true,
                write: false,
                desc: ""
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("SMARTMETER_ENERGYREACTIVE_PRODUCED_SUM_F64")){
        adapter.setObjectNotExists('meter.' + id + '.SMARTMETER_ENERGYREACTIVE_PRODUCED_SUM_F64',{
          type: "state",
          common: {
            name: "SUM REACTIVE ENERGY PRODUCED",
            type: "number",
            role: "value",
            unit: "VArh",
            read: true,
            write: false,
            desc: "SMARTMETER_ENERGYREACTIVE_PRODUCED_SUM_F64"
          },
          native: {}
        });
      }
    if(obj.hasOwnProperty("EnergyReactive_VArAC_Sum_Consumed")){
        adapter.setObjectNotExists('meter.' + id + '.EnergyReactive_VArAC_Sum_Consumed', {
            type: "state",
            common: {
                name: "SUM REACTIVE ENERGY CONSUMED",
                type: "number",
                role: "value",
                unit: "VArh",
                read: true,
                write: false,
                desc: ""
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("SMARTMETER_ENERGYREACTIVE_CONSUMED_SUM_F64")){
        adapter.setObjectNotExists('meter.' + id + '.SMARTMETER_ENERGYREACTIVE_CONSUMED_SUM_F64',{
          type: "state",
          common: {
            name: "SUM REACTIVE ENERGY CONSUMED",
            type: "number",
            role: "value",
            unit: "VArh",
            read: true,
            write: false,
            desc: "SMARTMETER_ENERGYREACTIVE_CONSUMED_SUM_F64"
          },
          native: {}
        });
    }
    if(obj.hasOwnProperty("EnergyReal_WAC_Plus_Absolute")){
        adapter.setObjectNotExists('meter.' + id + '.EnergyReal_WAC_Plus_Absolute', {
            type: "state",
            common: {
                name: "ACTIVE Energy consumed from grid",
                type: "number",
                role: "value",
                unit: "Wh",
                read: true,
                write: false,
                desc: ""
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("SMARTMETER_ENERGYACTIVE_ABSOLUT_PLUS_F64")){
        adapter.setObjectNotExists('meter.' + id + '.SMARTMETER_ENERGYACTIVE_ABSOLUT_PLUS_F64',{
          type: "state",
          common: {
            name: "ACTIVE Energy consumed from grid",
            type: "number",
            role: "value",
            unit: "Wh",
            read: true,
            write: false,
            desc: "SMARTMETER_ENERGYACTIVE_ABSOLUT_PLUS_F64"
          },
          native: {}
        });
    }
    if(obj.hasOwnProperty("EnergyReal_WAC_Minus_Absolute")){
        adapter.setObjectNotExists('meter.' + id + '.EnergyReal_WAC_Minus_Absolute', {
            type: "state",
            common: {
                name: "ACTIVE Energy feed in",
                type: "number",
                role: "value",
                unit: "Wh",
                read: true,
                write: false,
                desc: ""
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("SMARTMETER_ENERGYACTIVE_ABSOLUT_MINUS_F64")){
        adapter.setObjectNotExists('meter.' + id + '.SMARTMETER_ENERGYACTIVE_ABSOLUT_MINUS_F64',{
          type: "state",
          common: {
            name: "ACTIVE Energy feed in",
            type: "number",
            role: "value",
            unit: "Wh",
            read: true,
            write: false,
            desc: "SMARTMETER_ENERGYACTIVE_ABSOLUT_MINUS_F64"
          },
          native: {}
        });
    }
    if(obj.hasOwnProperty("SMARTMETER_POWERACTIVE_01_F64")){
        adapter.setObjectNotExists('meter.' + id + '.SMARTMETER_POWERACTIVE_01_F64',{
          type: "state",
          common: {
            name: "ACTIVE POWER L1",
            type: "number",
            role: "value",
            unit: "W",
            read: true,
            write: false,
            desc: "SMARTMETER_POWERACTIVE_01_F64"
          },
          native: {}
        });
    }
    if(obj.hasOwnProperty("SMARTMETER_POWERACTIVE_02_F64")){
        adapter.setObjectNotExists('meter.' + id + '.SMARTMETER_POWERACTIVE_02_F64',{
          type: "state",
          common: {
            name: "ACTIVE POWER L2",
            type: "number",
            role: "value",
            unit: "W",
            read: true,
            write: false,
            desc: "SMARTMETER_POWERACTIVE_02_F64"
          },
          native: {}
        });
    }
    if(obj.hasOwnProperty("SMARTMETER_POWERACTIVE_03_F64")){
        adapter.setObjectNotExists('meter.' + id + '.SMARTMETER_POWERACTIVE_03_F64',{
          type: "state",
          common: {
            name: "ACTIVE POWER L3",
            type: "number",
            role: "value",
            unit: "W",
            read: true,
            write: false,
            desc: "SMARTMETER_POWERACTIVE_03_F64"
          },
          native: {}
        });
    }
    if(obj.hasOwnProperty("SMARTMETER_POWERACTIVE_MEAN_01_F64")){
        adapter.setObjectNotExists('meter.' + id + '.SMARTMETER_POWERACTIVE_MEAN_01_F64',{
          type: "state",
          common: {
            name: "AVG ACTIVE POWER L1",
            type: "number",
            role: "value",
            unit: "W",
            read: true,
            write: false,
            desc: "SMARTMETER_POWERACTIVE_MEAN_01_F64"
          },
          native: {}
        });
    }
    if(obj.hasOwnProperty("SMARTMETER_POWERACTIVE_MEAN_02_F64")){
        adapter.setObjectNotExists('meter.' + id + '.SMARTMETER_POWERACTIVE_MEAN_02_F64',{
          type: "state",
          common: {
            name: "AVG ACTIVE POWER L2",
            type: "number",
            role: "value",
            unit: "W",
            read: true,
            write: false,
            desc: "SMARTMETER_POWERACTIVE_MEAN_02_F64"
          },
          native: {}
        });
    }
    if(obj.hasOwnProperty("SMARTMETER_POWERACTIVE_MEAN_03_F64")){
        adapter.setObjectNotExists('meter.' + id + '.SMARTMETER_POWERACTIVE_MEAN_03_F64',{
          type: "state",
          common: {
            name: "AVG ACTIVE POWER L3",
            type: "number",
            role: "value",
            unit: "W",
            read: true,
            write: false,
            desc: "SMARTMETER_POWERACTIVE_MEAN_03_F64"
          },
          native: {}
        });
    }
    if(obj.hasOwnProperty("SMARTMETER_POWERACTIVE_MEAN_SUM_F64")){
        adapter.setObjectNotExists('meter.' + id + '.SMARTMETER_POWERACTIVE_MEAN_SUM_F64',{
          type: "state",
          common: {
            name: "AVG ACTIVE POWER total",
            type: "number",
            role: "value",
            unit: "W",
            read: true,
            write: false,
            desc: "SMARTMETER_POWERACTIVE_MEAN_SUM_F64"
          },
          native: {}
        });
      }
    adapter.log.debug("MeterObjects created!")
    
    // wait a bit for creating the previous objects before creating the fallback once
    setTimeout(function(){
        adapter.log.debug("Fallback MissingMeterObjects started")
        // fallback for not predefined parameters -> defined as number without unit
        for (var para in obj){
            adapter.setObjectNotExists('meter.' + id + '.' + para.toString(), {
                type: "state",
                common: {
                    name: para.toString(),
                    type: "number",
                    role: "value",
                    unit: "",
                    read: true,
                    write: false,
                    desc: para.toString()
                },
                native: {}
            });
        }
        adapter.log.debug("FAllback MissingMeterObjects created!")
    },2000);
}

function getMeterRealtimeData(id) {
    request.get(requestType + ip + baseurl + 'GetMeterRealtimeData.cgi?Scope=Device&DeviceId=' + id, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            try {
                const data = JSON.parse(body);
                if ("Body" in data) {
                    const resp = data.Body.Data;
                    createMeterObjects(id,resp);
                    for (var par in resp){
                        adapter.setState("meter." + id + "." + par.toString(), {val: resp[par.toString()], ack: true});
                    }
                } else {
                    adapter.log.warn(data.Head.Status.Reason + " meter: " + id);
                }
            } catch (e) {
                adapter.log.warn(e);
            }
        }
    });
}

function createSensorNowObjects(id) {
    if(isObjectsCreated){
        return
    }
    adapter.setObjectNotExists('sensor', {
        type: 'channel',
        common: {
            name: "detailed information about Sensor devices",
            role: "info"
        },
        native: {}
    });
    adapter.setObjectNotExists('sensor.' + id, {
        type: 'channel',
        common: {
            name: "sensor with device ID " + id,
            role: "info"
        },
        native: {}
    });

}

function getSensorRealtimeDataNowSensorData(id) {
    request.get(requestType + ip + baseurl + 'GetSensorRealtimeData.cgi?Scope=Device&DeviceId=' + id + '&DataCollection=NowSensorData', function (error, response, body) {
        if (!error && response.statusCode == 200) {
            try {
                const data = JSON.parse(body);
                if ("Body" in data) {

                    createSensorNowObjects(id);

                    const resp = data.Body.Data;

                } else {
                    adapter.log.warn(data.Head.Status.Reason + " sensor: " + id);
                }
            } catch (e) {
                adapter.log.warn(e);
            }
        }
    });
}

function createSensorMinMaxObjects(id) {
    if(isObjectsCreated){
        return
    }
    adapter.setObjectNotExists('sensor', {
        type: 'channel',
        common: {
            name: "detailed information about Sensor devices",
            role: "info"
        },
        native: {}
    });
    adapter.setObjectNotExists('sensor.' + id, {
        type: 'channel',
        common: {
            name: "sensor with device ID " + id,
            role: "info"
        },
        native: {}
    });

}

function getSensorRealtimeDataMinMaxSensorData(id) {
    request.get(requestType + ip + baseurl + 'GetSensorRealtimeData.cgi?Scope=Device&DeviceId=' + id + '&DataCollection=MinMaxSensorData', function (error, response, body) {
        if (!error && response.statusCode == 200) {
            try {
                const data = JSON.parse(body);
                if ("Body" in data) {

                    createSensorMinMaxObjects(id);

                    const resp = data.Body.Data;

                } else {
                    adapter.log.warn(data.Head.Status.Reason + " sensor: " + id);
                }
            } catch (e) {
                adapter.log.warn(e);
            }
        }
    });
}

function getStringRealtimeData(id) {

}

function createPowerFlowObjects(obj) {
    if(isObjectsCreated){
        return
    }
    adapter.setObjectNotExists('powerflow', {
        type: 'channel',
        common: {
            name: "detailed information about the power flow",
            role: "info"
        },
        native: {}
    });

    if(obj.hasOwnProperty("Mode")){
        adapter.setObjectNotExists('powerflow.Mode', {
            type: "state",
            common: {
                name: "Mode",
                type: "string",
                role: "value",
                read: true,
                write: false,
                desc: "Power Flow Mode"
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("P_Grid")){
        adapter.setObjectNotExists('powerflow.P_Grid', {
            type: "state",
            common: {
                name: "grid power",
                type: "number",
                role: "value",
                unit: "W",
                read: true,
                write: false,
                desc: "grid power"
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("P_Load")){
        adapter.setObjectNotExists('powerflow.P_Load', {
            type: "state",
            common: {
                name: "load power",
                type: "number",
                role: "value",
                unit: "W",
                read: true,
                write: false,
                desc: "load power"
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("P_Akku")){
        adapter.setObjectNotExists('powerflow.P_Akku', {
            type: "state",
            common: {
                name: "akku power",
                type: "number",
                role: "value",
                unit: "W",
                read: true,
                write: false,
                desc: "akku power"
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("P_PV")){
        adapter.setObjectNotExists('powerflow.P_PV', {
            type: "state",
            common: {
                name: "pv power",
                type: "number",
                role: "value",
                unit: "W",
                read: true,
                write: false,
                desc: "pv power"
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("E_Day")){
        adapter.setObjectNotExists('powerflow.E_Day', {
            type: "state",
            common: {
                name: "pv power day",
                type: "number",
                role: "value",
                unit: "Wh",
                read: true,
                write: false,
                desc: "pv power day"
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("E_Year")){
        adapter.setObjectNotExists('powerflow.E_Year', {
            type: "state",
            common: {
                name: "pv power year",
                type: "number",
                role: "value",
                unit: "Wh",
                read: true,
                write: false,
                desc: "pv power year"
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("E_Total")){
        adapter.setObjectNotExists('powerflow.E_Total', {
            type: "state",
            common: {
                name: "pv power total",
                type: "number",
                role: "value",
                unit: "Wh",
                read: true,
                write: false,
                desc: "pv power total"
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("P_Autonomy")){
        adapter.setObjectNotExists('powerflow.P_Autonomy', {
            type: "state",
            common: {
                name: "pv Autonomy",
                type: "number",
                role: "value",
                unit: "%",
                read: true,
                write: false,
                desc: "pv autonomy"
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("rel_Autonomy")){
        adapter.setObjectNotExists('powerflow.rel_Autonomy', {
            type: "state",
            common: {
                name: "pv Autonomy",
                type: "number",
                role: "value",
                unit: "%",
                read: true,
                write: false,
                desc: "pv autonomy"
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("P_SelfConsumption")){
        adapter.setObjectNotExists('powerflow.P_SelfConsumption', {
            type: "state",
            common: {
                name: "pv SelfConsumption",
                type: "number",
                role: "value",
                unit: "%",
                read: true,
                write: false,
                desc: "pv self consumption"
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("rel_SelfConsumption")){
        adapter.setObjectNotExists('powerflow.rel_SelfConsumption', {
            type: "state",
            common: {
                name: "pv SelfConsumption",
                type: "number",
                role: "value",
                unit: "%",
                read: true,
                write: false,
                desc: "pv self consumption"
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("BatteryStandby")){
        adapter.setObjectNotExists('powerflow.BatteryStandby', {
            type: "state",
            common: {
                name: "Battery standby",
                type: "boolean",
                role: "value",
                unit: "",
                read: true,
                write: false,
                desc: "Battery standby"
            },
            native: {}
        });
    }
    if(obj.hasOwnProperty("Meter_Location")){
        adapter.setObjectNotExists('powerflow.Meter_Location', {
            type: "state",
            common: {
                name: "SmartMeter location",
                type: "string",
                role: "value",
                unit: "",
                read: true,
                write: false,
                desc: "Smartmeter location"
            },
            native: {}
        });
    }

    // wait a bit for creating the previous objects before creating the fallback once
    setTimeout(function(){
        adapter.log.debug("Fallback creating missing Powerflow objects started")
        // fallback for not predefined parameters -> defined as number without unit
        for (var para in obj){
            adapter.setObjectNotExists('powerflow.' + para.toString(), {
                type: "state",
                common: {
                    name: para.toString(),
                    type: "number",
                    role: "value",
                    unit: "",
                    read: true,
                    write: false,
                    desc: para.toString()
                },
                native: {}
            });
        }
        adapter.log.debug("Fallback creating missing Powerflow objects finished!")
    },2000);
}

function getPowerFlowRealtimeData() {
    request.get(requestType + ip + baseurl + 'GetPowerFlowRealtimeData.fcgi', function (error, response, body) {
        if (!error && response.statusCode == 200) {
            try {
                const data = JSON.parse(body);
                if ("Body" in data) {

                    

                    const resp = data.Body.Data.Site;
                    createPowerFlowObjects(resp);
                    for (var par in resp){
                        adapter.setState("powerflow." + par.toString(), {val: resp[par.toString()]==null ? 0:resp[par.toString()], ack: true});
                    }

                } else {
                    adapter.log.warn(data.Head.Status.Reason + " sensor: " + id);
                }
            } catch (e) {
                adapter.log.warn(e);
            }
        }
    });
}

function createInfoObjects() {
    if(isObjectsCreated){
        return
    }
    adapter.delObject('connection');
    adapter.delObject('lastsync');
    adapter.delObject('HWVersion');
    adapter.delObject('SWVersion');

    adapter.setObjectNotExists('info', {
        type: 'channel',
        common: {
            name: "Information"
        },
        native: {}
    });
    adapter.setObjectNotExists('info.connection', {
        type: 'state',
        common: {
            name: "Fronius connected",
            type: "boolean",
            role: "indicator.connected",
            read: true,
            write: false,
            def: false,
            desc: "Is Fronius inverter connected?"
        },
        native: {}
    });
    adapter.setObjectNotExists('info.lastsync', {
        type: 'state',
        common: {
            name: "Last successful sync",
            type: "string",
            role: "value.datetime",
            read: true,
            write: false,
            desc: "Last successful synchronization"
        },
        native: {}
    });
    adapter.setObjectNotExists('info.HWVersion', {
        type: 'state',
        common: {
            name: "Hardware Version",
            type: "string",
            role: "meta",
            read: true,
            write: false,
            def: "",
            desc: "Hardware Version"
        },
        native: {}
    });
    adapter.setObjectNotExists('info.SWVersion', {
        type: 'state',
        common: {
            name: "Software Version",
            type: "string",
            role: "meta",
            read: true,
            write: false,
            def: "",
            desc: "Software Version"
        },
        native: {}
    });
}

function setConnected(_isConnected) {
    if (isConnected !== _isConnected) {
        isConnected = _isConnected;
        adapter.setState('info.connection', {val: isConnected, ack: true});
    }
}

function checkStatus() {
    ping.probe(ip, {log: adapter.log.debug}, function (err, result) {
        if (err) {
            adapter.log.error(err);
        }
        if (result) {
            setConnected(result.alive);
            if (result.alive) {
                adapter.config.inverter.split(',').forEach(function (entry) {
                    getInverterRealtimeData(entry);
                });
                if (adapter.config.sensorCard) {
                    adapter.config.sensorCard.split(',').forEach(function (entry) {
                        getSensorRealtimeDataNowSensorData(entry);
                        getSensorRealtimeDataMinMaxSensorData(entry);
                    });
                }
                if (adapter.config.stringControl) {
                    adapter.config.stringControl.split(',').forEach(function (entry) {
                        getStringRealtimeData(entry);
                    });
                }

                if (apiver === 1) {
                    if (adapter.config.meter) {
                        adapter.config.meter.split(',').forEach(function (entry) {
                            getMeterRealtimeData(entry);
                        });
                    }
                    if (adapter.config.storage) {
                        adapter.config.storage.split(',').forEach(function (entry) {
                            getStorageRealtimeData(entry);
                        });
                    }
                    getPowerFlowRealtimeData();
                }

                adapter.setState("info.lastsync", {val: new Date().toISOString(), ack: true});
                // allow enough time to finish all the previous state creation before setting the value to true
                setTimeout(function(){
                    isObjectsCreated = true
                },10000);
            }
        }
    });
}

//Hardware and Software Version
function getLoggerInfo() {
    request.get(requestType + ip + baseurl + 'GetLoggerInfo.cgi', function (error, response, body) {
        if (!error && response.statusCode == 200) {
            try {
                const data = JSON.parse(body);
                if ("Body" in data) {
                    const resp = data.Body.LoggerInfo;
                    if(resp && resp.hasOwnProperty("HWVersion")){
                        adapter.setState("info.HWVersion", {val: resp.HWVersion, ack: true});
                        adapter.setState("info.SWVersion", {val: resp.SWVersion, ack: true});
                    }
                } else {
                    adapter.log.warn(data.Head.Status.Reason);
                }
            } catch (e) {
                adapter.log.warn(e);
            }
        }
        if (error != null) {
            adapter.log.warn(error);
        }
    });
}

function main() {

    // The adapters config (in the instance object everything under the attribute "native") is accessible via
    // adapter.config:

    ip = adapter.config.ip;
    baseurl = adapter.config.baseurl;
    apiver = parseInt(adapter.config.apiversion);
    requestType = adapter.config.requestType;

    if (ip && baseurl) {

        createInfoObjects();
        getLoggerInfo();
        checkStatus();

        let secs = adapter.config.poll;
        if (isNaN(secs) || secs < 1) {
            secs = 10;
        }

        setInterval(checkStatus, secs * 1000);

    } else {
        adapter.log.error("Please configure the Fronius adapter");
    }


}

// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
    module.exports = startAdapter;
} else {
    // or start the instance directly
    startAdapter();
} 
