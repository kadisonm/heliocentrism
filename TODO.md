# TODO

---

# General Fixes
- Change the pomodoro timer auto play to a better icon
- Add a reset timer to the pomodoro timer widget

- Allow widgets to be placed anywhere without gravity

## Tasks
- Fix tasks minimum stage not being updated
- Make it so when dragging tasks it has a grey filter
- Fix unfinishing a task using the parent not updating all sub tasks to be unfinished too
- Hide task stages badge for normal tasks (setting)
- Popup should switch sides if it is going to go off the screen

- Make it use my firestore by default

- Make it so that the stages can select colours from the extended colour css\

fix task overlaing edge of page

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