<!--- Provide a general summary of your changes in the Title above -->

## Description
<!--- Describe your changes in detail -->

## Motivation and Context
<!--- Why is this change required? What problem does it solve? -->
<!--- If it fixes an open issue, please link to the issue here. -->

## How Has This Been Tested?
<!--- Please describe in detail how you tested your changes. -->
<!--- Include details of your testing environment, and the tests you ran -->
<!--- Describe how your change affects other areas of the code, etc. -->

## Types of Changes
<!--- What types of changes does your code introduce? Put an `x` in all the boxes that apply: -->
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)

## Checklist
- [ ] I have updated the documentation accordingly (link here).
- [ ] I have tested that this feature locally.
- [ ] I have added tests to cover my changes.
- [ ] All new and existing tests passed.
- [ ] Reviewer has tested this feature locally

## Testing Checklist
**Apps Page**
- [ ] All Apps are clickable and reroute you to a new site

**Explorer Pages**
- [ ] Selecting SMMART project ID on the SMMART explorer page populates rows with metadata
- [ ] Selecting HTAN project ID on the SMMART explorer page populates rows with metadata
- [ ] On SMMART Files Tab, clicking file download button downloads the file 
- [ ] On SMMART Tab, clicking image button opens the ome.tiff file in a new tab for
    - [ ] HTAN explorer
    - [ ] SMMART explorer
- [ ] Files Tab, clicking image button opens the ome.tiff file in a new tab for
    - [ ] HTAN explorer
    - [ ] SMMART explorer


**Explorer Filters**
- [ ] When selecting multiple facets...
    - [ ] File counts update and match across different facets
    - [ ] Filters bar above the Explorer tab update
    - [ ] Number of rows and row contents of Explorer table match the facets
- [ ] When enabling shared filters (top left)...
    - [ ] Shared filters can be added and removed from the checkboxes
    - [ ] When selecting multiple facets (eg project Id and participant ID), the facets get carried over via the Filters Tab
    - [ ] Facets that don’t carry over across tabs can still be faceted on the relevant tab


**Subject Report (SMMART)**
- [ ] All tables are populated with relevant data
- [ ] Pie charts updated for multiple subject
- [ ] Pie charts match counts in Assay Summary for the same subject


**Specimen Report**
- [ ]  Spot-check specimen panel information...
    - [ ]  Populates all values in the subject summary table
    - [ ]  Populates values that match the clicked row within the specimen summary tabble
- [ ] Spot-check specimen tree for multiple specimens
    - [ ] Has a nested dropdown detailing the specimen and its sample type
    - [ ] Can toggle to graph version with the same info
    - [ ] Is bolded for each parent specimen corresponding
- [ ] File counts in Specimen Summary section match the Files table rows at the bottom




**Medication Report**
- [ ] I can see the history of medications across time


**Image Viewer**
- [ ] I can open a file from the Apps page
- [ ] I can zoom in and the image re-renders


**Themes / Visuals / General Content**
- [ ] Almost all blue when doing filters, popups, general page paneling (for the most part)
- [ ] Logos on the bottom and top left render
- [ ] Writing has the Lato typeface
- [ ] Corners are rounded across the site


**Profile Page**
- [ ] I can create a token using “Create API Key”
- [ ] I can see the list of token and whether they’re expired
- [ ] I can download and verify that the new token works via a ping

**File Summary Page**
- [ ] When selecting a project on the top-left donut chart, the histogram repopulates
- [ ] When selecting a histogram bar on top right, files repopulate
- [ ] Able to toggle top right and select a different bar to repopulate the table
- [ ] Number of rows match the number described by hovering over a histogram bar

