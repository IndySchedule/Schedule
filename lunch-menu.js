(function (global) {
    'use strict';

    const OFFICIAL_MENU_URL = 'https://www.wcs.edu/about-us/menus-nutrition';

    // Add each new monthly menu here using YYYY-MM-DD keys. Values can be a
    // single string or an array of menu items. Dates that are not listed
    // automatically fall back to the official WCS menus page.
    const DAILY_OPTIONS = 'A variety of sandwiches, signature salads, fresh fruits, side salads, vegetables, and beverages are also offered.';

    const MENUS = Object.freeze({
        '2026-08-11': Object.freeze(['Mini Corndogs', 'Sloppy Joe Sandwich', 'Tater Tots', 'Choice of Hot Vegetable']),
        '2026-08-12': Object.freeze(['Teriyaki Meatballs', 'Sweet & Sour Chicken', 'Fried Rice', 'Choice of Hot Vegetable']),
        '2026-08-13': Object.freeze(['Popcorn Chicken with Roll', 'Meatball Sub', 'Baked Apples', 'Choice of Hot Vegetable']),
        '2026-08-14': Object.freeze(['Wings', 'BBQ Chicken Sandwich', 'Oven Baked Fries', 'Choice of Hot Vegetable']),
        '2026-08-17': Object.freeze(['Chicken Tenders with Roll', 'Grilled Cheese Sandwich', 'Mashed Potatoes with Gravy', 'Choice of Hot Vegetable']),
        '2026-08-18': Object.freeze(['Beef Soft or Hard Tacos', 'Chicken Soft or Hard Tacos', 'Refried Beans', 'Choice of Hot Vegetable']),
        '2026-08-19': Object.freeze(['Corndog', 'Chicken Nuggets with Roll', 'Oven Baked Fries', 'Choice of Hot Vegetable']),
        '2026-08-20': Object.freeze(['Chicken Alfredo', 'Cheese Calzone', 'Baked Peaches', 'Choice of Hot Vegetable']),
        '2026-08-21': Object.freeze(['Wings', 'Hot Dog', 'Oven Baked Fries', 'Choice of Hot Vegetable']),
        '2026-08-24': Object.freeze(['Breaded Drumstick with Roll', 'Mini Corndogs', 'Mac & Cheese', 'Choice of Hot Vegetable']),
        '2026-08-25': Object.freeze(['Beef or Chicken Walking Taco', 'Chicken Empanada', 'Spanish Rice', 'Choice of Hot Vegetable']),
        '2026-08-26': Object.freeze(['Teriyaki Meatballs', 'Orange Chicken', 'Fried Rice', 'Choice of Hot Vegetable']),
        '2026-08-27': Object.freeze(['Ham & Cheese Croissant', 'Fish Sticks', 'Sweet Potato Casserole', 'Choice of Hot Vegetable']),
        '2026-08-28': Object.freeze(['Wings', 'Open Faced Sloppy Joe', 'Oven Baked Fries', 'Choice of Hot Vegetable']),
        '2026-08-31': Object.freeze(['Chicken Nuggets with Roll', 'BBQ Sandwich', 'Baked Beans', 'Choice of Hot Vegetable'])
    });

    function getMenu(dateKey) {
        const menu = MENUS[dateKey];
        if (!menu) return null;
        return Array.isArray(menu) ? menu.slice() : [String(menu)];
    }

    global.IndyLunchMenu = Object.freeze({
        OFFICIAL_MENU_URL,
        DAILY_OPTIONS,
        MENUS,
        getMenu
    });
})(globalThis);
