(function (global) {
    'use strict';

    // Generated from the official WCS high-school lunch PDF.
    // Run `npm run update-lunch` instead of editing monthly entries by hand.
    const OFFICIAL_MENU_URL = "https://www.wcs.edu/about-us/menus-nutrition";
    const SOURCE_DOCUMENT_URL = "https://docs.wcs.edu/pdf/food/September-2026-High-School-Lunch-Menu.pdf";
    const SOURCE_LABEL = 'WCS High School Lunch Menu';
    const SOURCE_HASH = "c104026447b894cb70943cc029a4627a779b361f8864bf093b9a441a9a533c99";
    const MENU_MONTH = "2026-09";
    const UPDATED_AT = "2026-08-24T18:39:33.000Z";
    const COVERAGE_START = "2026-08-11";
    const COVERAGE_END = "2026-09-30";
    const DAILY_OPTIONS = "A variety of sandwiches, signature salads, fresh fruits, side salads, vegetables, and beverages are also offered.";

    const MENUS = Object.freeze({
        "2026-08-11": Object.freeze(["Mini Corndogs","Sloppy Joe Sandwich","Tater Tots","Choice of Hot Vegetable"]),
        "2026-08-12": Object.freeze(["Teriyaki Meatballs","Sweet & Sour Chicken","Fried Rice","Choice of Hot Vegetable"]),
        "2026-08-13": Object.freeze(["Popcorn Chicken with Roll","Meatball Sub","Baked Apples","Choice of Hot Vegetable"]),
        "2026-08-14": Object.freeze(["Wings","BBQ Chicken Sandwich","Oven Baked Fries","Choice of Hot Vegetable"]),
        "2026-08-17": Object.freeze(["Chicken Tenders with Roll","Grilled Cheese Sandwich","Mashed Potatoes with Gravy","Choice of Hot Vegetable"]),
        "2026-08-18": Object.freeze(["Beef Soft or Hard Tacos","Chicken Soft or Hard Tacos","Refried Beans","Choice of Hot Vegetable"]),
        "2026-08-19": Object.freeze(["Corndog","Chicken Nuggets with Roll","Oven Baked Fries","Choice of Hot Vegetable"]),
        "2026-08-20": Object.freeze(["Chicken Alfredo","Cheese Calzone","Baked Peaches","Choice of Hot Vegetable"]),
        "2026-08-21": Object.freeze(["Wings","Hot Dog","Oven Baked Fries","Choice of Hot Vegetable"]),
        "2026-08-24": Object.freeze(["Breaded Drumstick with Roll","Mini Corndogs","Mac & Cheese","Choice of Hot Vegetable"]),
        "2026-08-25": Object.freeze(["Beef or Chicken Walking Taco","Chicken Empanada","Spanish Rice","Choice of Hot Vegetable"]),
        "2026-08-26": Object.freeze(["Teriyaki Meatballs","Orange Chicken","Fried Rice","Choice of Hot Vegetable"]),
        "2026-08-27": Object.freeze(["Ham & Cheese Croissant","Fish Sticks","Sweet Potato Casserole","Choice of Hot Vegetable"]),
        "2026-08-28": Object.freeze(["Wings","Open Faced Sloppy Joe","Oven Baked Fries","Choice of Hot Vegetable"]),
        "2026-08-31": Object.freeze(["Chicken Nuggets with Roll","BBQ Sandwich","Baked Beans","Choice of Hot Vegetable"]),
        "2026-09-01": Object.freeze(["Mini Corndogs","Sloppy Joe Sandwich","Tater Tots","Choice of Hot Vegetable"]),
        "2026-09-02": Object.freeze(["Teriyaki Meatballs","Sweet & Sour Chicken","Veggie Eggroll","Fried Rice","Choice Of Hot Vegetable"]),
        "2026-09-03": Object.freeze(["Popcorn Chicken w/roll","Meatball Sub","Baked Apples","Choice of Hot Vegetable"]),
        "2026-09-04": Object.freeze(["Wings","BBQ Chicken Sandwich","Oven Baked Fries","Choice of Hot Vegetable"]),
        "2026-09-08": Object.freeze(["Beef Soft or Hard Tacos","Chicken Soft or Hard Tacos","Refried Beans","Choice of Hot Vegetable"]),
        "2026-09-09": Object.freeze(["Corndog","Chicken Nuggets w/roll","Oven Baked Fries","Choice of Hot Vegetable"]),
        "2026-09-10": Object.freeze(["Chicken Alfredo","Cheese Calzone","Baked Peaches","Choice of Hot Vegetable"]),
        "2026-09-11": Object.freeze(["Wings","Hot Dog","Oven Baked Fries","Choice of Hot Vegetable"]),
        "2026-09-14": Object.freeze(["Chicken Tenders w/Roll","Grilled Cheese Sandwich","Mashed Potatoes w/gravy","Choice of Hot Vegetable"]),
        "2026-09-15": Object.freeze(["Beef Nachos","Chicken Nachos","Rancho Beans","Choice of Hot Vegetable"]),
        "2026-09-16": Object.freeze(["Sweet Chili Meatballs","Teriyaki Chicken","Veggie Eggroll","Fried Rice","Choice Of Hot Vegetable"]),
        "2026-09-17": Object.freeze(["Chicken Nuggets w/roll","Fish Sandwich","Au Gratin Potato’s","Choice of Hot Vegetable"]),
        "2026-09-18": Object.freeze(["Wings","Open Faced Sloppy Joe","Oven Baked Fries","Choice of Hot Vegetable"]),
        "2026-09-21": Object.freeze(["Breaded Drumstick w/Roll","Mini Corndogs","Mac & Cheese","Choice of Hot Vegetable"]),
        "2026-09-22": Object.freeze(["Beef Soft or Hard Tacos","Chicken Soft or Hard Tacos","Refried Beans","Choice of Hot Vegetable"]),
        "2026-09-23": Object.freeze(["Popcorn Chicken w/roll","Loaded Baked Potato","Au Gratin Potato’s","Choice of Hot Vegetable"]),
        "2026-09-24": Object.freeze(["Rattlesnake Pasta w/ Grilled Chicken","Chicken Parmesan Sandwich","Baked Peaches","Choice of Hot Vegetable"]),
        "2026-09-25": Object.freeze(["Wings","Fish sticks","Oven Baked Fries","Choice of Hot Vegetable"]),
        "2026-09-28": Object.freeze(["Chicken Nuggets w/roll","BBQ Sandwich","Baked Beans","Choice of Hot Vegetable"]),
        "2026-09-29": Object.freeze(["Beef or Chicken Walking Taco","Pizza Quesadilla","Spanish Rice","Choice of Hot Vegetable"]),
        "2026-09-30": Object.freeze(["Teriyaki Meatballs","Sweet & Sour Chicken","Veggie Eggroll","Fried Rice","Choice Of Hot Vegetable"])
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
