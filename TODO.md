# TODO

---

# General Fixes
- Change the pomodoro timer auto play to a better icon
- Add a reset timer to the pomodoro timer widget

- Refactor all the css files to match a similar structure to the actual tsx files

- When switching pages you can visibly see all the widgets slightly reload as they do a pixel jitter. (and the orbit animation restarts)

- Make it so the pages navigation matches the figma mock
- Make it so the edit button has a frosted glass effect
- Make it so that the bottom of the screen has a slight vignette
- Make it so that the background has a cool simple and optimised space background pattern (with the ability for this background to be changeable in the settings - with a preview)
- Fix the outline transition abruptly complete suddenly whlie it is still fading (presumably the page is loading before the transition finishes causing it to suddenly appear solid)

- Create mobile header
- Create mobile navigation + edit button

## Tasks
- Fix tasks minimum stage not being updated
- Fix unfinishing a task using the parent not updating all sub tasks to be unfinished too
- Hide task stages badge for normal tasks (setting)
- Dragging a task on mobile doesnt make the page scroll up with it


only one context menu should be able to be opened at one time

- Make it so clicking and holding when dragging tasks ignores if the user is currently typing in one of the text areas. (But make sure the user can still select without it counting as a drag)

Make it so that adding a new task just adds a blank task to the bottom of the list and remove the old add task modal


- Make it use my firestore by default

- Make it so that the stages can select colours from the extended colour css\

- Dragging a thin task over a thicker task doesnt move the thicker task out the way and the tasks just overlap. It must pick to either move out the way up or down.

---

# Data
- Figure out how to allow google accounts to also be connected to an email address and password. (For google calendar integration etc)
- Add import and export firebase sync settings + the option to export/ import user data
- Add data backups and the option to export them/ change how often and how many are saved
- Force the user to configure before they can access the dashboard and make sure they can only see the configuration screen.
- Write tutorial for adding firebase domain 

---

# Dashboard
- Investigate tablet mode and turning the tablet to portrait

## Multiple pages feature
- [ ] Implemented?
### Pages
- Each layout can have as many pages as the user creates (max 30?)
- Pages must have at least one widget otherwise they are deleted
- Pages can have a reasonable length limit like 10 screen height worths if the user puts widgets down that far
- Show a warning line underneath the grid when the page limit it reached

### Navigation
- Dot navigation shows at the bottom centre of the screen (inline with the height of the edit button) when there is more than one page, or while in edit mode.
- Clicking a dot will switch to its corresponding page.
- On mobile/desktop swiping quickly can switch pages, pressing the navigation dot, or using the arrow keys on a keyboard
- In edit mode, the canvas shrinks down slightly and adds a white border around the grid. The immediate surrounding pages show to the left and right of it. These can be clicked on to navigate to or navigated to using the above method.
- When not in edit mode, you can only see the canvas of the page you are currently on. The current page appears at full height and width like it currently does,

### Creating Pages
- During edit mode there must always be a blank page after the last page. If on the last page (or first if there is only one page) the blank page can be seen to the right of it as if it was another page that existed.
- The blank page can be navigated to like normal or by clcking on its muted border. This page is also temporarily added to the nav but is uninitialised and technically doesnt exist.
- If the user stops editing while on the uninitialised page, then the current page automatiicaly switches back to the last actual page.
- Dragging a widget to a unmade page or adding a widget to it initialises it as a new page and adds it to the switcher permanantly (though deleting all widgets in a page removes it from the page switcher too). 
   
## Widget Ideas
- Date and time
- Simple Time
- Simple Clock

- Date time and weather (includes weather warnings)
- Simple weather (temp, conditions, and uv)

- Photo
- GIF

- Agenda view (horizontal or vertical)
- Quick Notes (A notepad that just keeps whatever you write in it)
- Reminders
- Goals
- Habits + heatmap (Maybe can integrate into routines?)
    Include a stats button for nice statistics

- Google Calendar today's events
- Upcoming google calendar event list
- Spotify player

- The current season, and if any pollen is active

# Family

# Health

# Fitness
- Widget to track your weight
- Macros, water?

# Garden
- Customisable garden layout, the current season and what plants do best.
- Ideal planting time and estimated harvest time