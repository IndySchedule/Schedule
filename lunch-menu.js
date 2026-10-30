(function (global) {
    'use strict';

    // Generated from the official WCS high-school lunch PDF.
    // Run `npm run update-lunch` instead of editing monthly entries by hand.
    const OFFICIAL_MENU_URL = "https://www.wcs.edu/about-us/menus-nutrition";
    const SOURCE_DOCUMENT_URL = "https://docs.wcs.edu/pdf/food/November-2026-High-School-Lunch-Menu.pdf";
    const SOURCE_LABEL = 'WCS High School Lunch Menu';
    const SOURCE_HASH = "29e746739f26c952f540088446f13bed1bf44fe8e597cdb1c4a90fa475fa1a47";
    const MENU_MONTH = "2026-11";
    const UPDATED_AT = "2026-10-30T16:15:45.000Z";
    const COVERAGE_START = "2026-10-01";
    const COVERAGE_END = "2026-11-30";
    const DAILY_OPTIONS = "A variety of sandwiches, signature salads, fresh fruits, side salads, vegetables, and beverages are also offered.";

    const MENUS = Object.freeze({
        "2026-10-01": Object.freeze(["Popcorn Chicken w/roll","Meatball Sub","Baked Apples","Choice of Hot Vegetable"]),
        "2026-10-02": Object.freeze(["Wings","BBQ Chicken Sandwich","Oven Baked Fries","Choice of Hot Vegetable"]),
        "2026-10-05": Object.freeze(["Chicken Tenders w/Roll","Grilled Cheese Sandwich","Mashed Potatoes w/gravy","Choice of Hot Vegetable"]),
        "2026-10-06": Object.freeze(["Beef Nachos","Chicken Nachos","Rancho Beans","Choice of Hot Vegetable"]),
        "2026-10-07": Object.freeze(["Corndog","Chicken Nuggets w/roll","Oven Baked Fries","Choice of Hot Vegetable"]),
        "2026-10-08": Object.freeze(["Chicken Alfredo","Cheese Calzone","Baked Peaches","Choice of Hot Vegetable"]),
        "2026-10-09": Object.freeze(["Wings","Hot Dog","Oven Baked Fries","Choice of Hot Vegetable"]),
        "2026-10-19": Object.freeze(["Breaded Drumstick w/Roll","Mini Corndogs","Mac & Cheese","Choice of Hot Vegetable"]),
        "2026-10-20": Object.freeze(["Beef Soft or Hard Tacos","Chicken Soft or Hard Tacos","Refried Beans","Choice of Hot Vegetable"]),
        "2026-10-21": Object.freeze(["Popcorn Chicken w/roll","Loaded Baked Potato","Au Gratin Potato’s","Choice of Hot Vegetable"]),
        "2026-10-22": Object.freeze(["Rattlesnake Pasta w/ Grilled Chicken","Chicken Parmesan Sandwich","Baked Peaches","Choice of Hot Vegetable"]),
        "2026-10-23": Object.freeze(["Wings","Fish sticks","Oven Baked Fries","Choice of Hot Vegetable"]),
        "2026-10-26": Object.freeze(["Chicken Nuggets w/roll","BBQ Sandwich","Baked Beans","Choice of Hot Vegetable"]),
        "2026-10-27": Object.freeze(["Beef or Chicken Walking Taco","Pizza Quesadilla","Spanish Rice","Choice of Hot Vegetable"]),
        "2026-10-28": Object.freeze(["Teriyaki Meatballs","Sweet & Sour Chicken","Veggie Eggroll","Fried Rice","Choice Of Hot Vegetable"]),
        "2026-10-29": Object.freeze(["Chicken Nuggets w/roll","Fish Sandwich","Au Gratin Potato’s","Choice of Hot Vegetable"]),
        "2026-10-30": Object.freeze(["Wings","Open Faced Sloppy Joe","Oven Baked Fries","Choice of Hot Vegetable"]),
        "2026-11-02": Object.freeze(["Chicken Tenders w/roll","Grilled Cheese Sandwich","Mashed Potatoes w/gravy","Choice of Hot Vegetable"]),
        "2026-11-04": Object.freeze(["Corndog","Chicken Nuggets w/roll","Oven Baked Fries","Choice of Hot Vegetable"]),
        "2026-11-05": Object.freeze(["Chicken Alfredo","Cheese Calzone","Baked Peaches","Choice of Hot Vegetable"]),
        "2026-11-06": Object.freeze(["Wings","BBQ Chicken Sandwich","Oven Baked Fries","Choice of Hot Vegetable"]),
        "2026-11-09": Object.freeze(["Breaded Drumstick w/roll","Mini Corndogs","Mac & Cheese","Choice of Hot Vegetable"]),
        "2026-11-10": Object.freeze(["Beef Soft or Hard Tacos","Chicken Soft or Hard Tacos","Refried Beans","Choice of Hot Vegetable"]),
        "2026-11-11": Object.freeze(["Popcorn Chicken w/roll","Loaded Baked Potato","Au Gratin Potato’s","Choice of Hot Vegetable"]),
        "2026-11-12": Object.freeze(["Rattlesnake Pasta w/ Grilled Chicken","Chicken Parmesan Sandwich","Baked Apples","Choice of Hot Vegetable"]),
        "2026-11-13": Object.freeze(["Wings","Hot Dog","Oven Baked Fries","Choice of Hot Vegetable"]),
        "2026-11-16": Object.freeze(["Chicken Nuggets w/roll","BBQ Sandwich","Baked Beans","Choice of Hot Vegetable"]),
        "2026-11-17": Object.freeze(["Beef or Chicken Walking Taco","Pizza Quesadilla w/Chicken","Spanish Rice","Choice of Hot Vegetable"]),
        "2026-11-18": Object.freeze(["Teriyaki Meatballs","Sweet & Sour Chicken","Veggie Eggroll","Fried Rice","Choice Of Hot Vegetable"]),
        "2026-11-19": Object.freeze(["Chicken Tenders w/roll","Fish Sandwich","Au Gratin Potato’s","Choice of Hot Vegetable"]),
        "2026-11-20": Object.freeze(["Wings","Sloppy Joe Sandwich","Oven Baked Fries","Choice of Hot Vegetable"]),
        "2026-11-30": Object.freeze(["Popcorn Chicken w/roll","Meatball Sub","Tater Tots","Choice of Hot Vegetable"])
    });

    function getMenu(dateKey) {
        const menu = MENUS[dateKey];
        return menu ? menu.slice() : null;
    }

    global.IndyLunchMenu = Object.freeze({
        schemaVersion: 1, ready: true, OFFICIAL_MENU_URL, SOURCE_DOCUMENT_URL, SOURCE_LABEL, SOURCE_HASH,
        MENU_MONTH, UPDATED_AT, COVERAGE_START, COVERAGE_END, DAILY_OPTIONS, MENUS, getMenu
    });
})(globalThis);
