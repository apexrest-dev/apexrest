# help text: parameters

component:regions/help-text

Parameter identities include their component context and APEXlang path. UI labels alone are not unique. Raw database return values and DSL enum values may differ. Missing descriptions or unresolved paths are not inferred as supported syntax.

Region template options and component-template options are independent surfaces. Current selections do not establish defaults. #DEFAULT# selects template defaults; it is not a CSS class.

```json
{
  "templateOptions": [
    {
      "id": "template-option:region/content-block/ADD_BODY_PADDING",
      "name": "ADD_BODY_PADDING",
      "label": "Add Body Padding",
      "cssClasses": [
        "t-ContentBlock--padded"
      ],
      "groupId": null,
      "templateTypes": [
        "REGION"
      ],
      "templates": {
        "region": "Content Block"
      },
      "virtualTemplateType": "REGION",
      "advanced": false,
      "sourceHasHelp": true,
      "description": "Adds padding to the region's body container.",
      "descriptionOrigin": "oracle-upl"
    },
    {
      "id": "template-option:region/content-block/CONTENT_TITLE_H1",
      "name": "CONTENT_TITLE_H1",
      "label": "Large",
      "cssClasses": [
        "t-ContentBlock--h1"
      ],
      "groupId": "template-group:region/region-title",
      "templateTypes": [
        "REGION"
      ],
      "templates": {
        "region": "Content Block"
      },
      "virtualTemplateType": "REGION",
      "advanced": false,
      "sourceHasHelp": false,
      "description": "Large: applies t-ContentBlock--h1 within its option group.",
      "descriptionOrigin": "apexrest-factual-summary"
    },
    {
      "id": "template-option:region/content-block/CONTENT_TITLE_H2",
      "name": "CONTENT_TITLE_H2",
      "label": "Medium",
      "cssClasses": [
        "t-ContentBlock--h2"
      ],
      "groupId": "template-group:region/region-title",
      "templateTypes": [
        "REGION"
      ],
      "templates": {
        "region": "Content Block"
      },
      "virtualTemplateType": "REGION",
      "advanced": false,
      "sourceHasHelp": false,
      "description": "Medium: applies t-ContentBlock--h2 within its option group.",
      "descriptionOrigin": "apexrest-factual-summary"
    },
    {
      "id": "template-option:region/content-block/CONTENT_TITLE_H3",
      "name": "CONTENT_TITLE_H3",
      "label": "Small",
      "cssClasses": [
        "t-ContentBlock--h3"
      ],
      "groupId": "template-group:region/region-title",
      "templateTypes": [
        "REGION"
      ],
      "templates": {
        "region": "Content Block"
      },
      "virtualTemplateType": "REGION",
      "advanced": false,
      "sourceHasHelp": false,
      "description": "Small: applies t-ContentBlock--h3 within its option group.",
      "descriptionOrigin": "apexrest-factual-summary"
    },
    {
      "id": "template-option:region/content-block/HEADING_FONT_ALTERNATIVE",
      "name": "HEADING_FONT_ALTERNATIVE",
      "label": "Alternative",
      "cssClasses": [
        "t-ContentBlock--headingFontAlt"
      ],
      "groupId": "template-group:region/heading-font",
      "templateTypes": [
        "REGION"
      ],
      "templates": {
        "region": "Content Block"
      },
      "virtualTemplateType": "REGION",
      "advanced": false,
      "sourceHasHelp": false,
      "description": "Alternative: applies t-ContentBlock--headingFontAlt within its option group.",
      "descriptionOrigin": "apexrest-factual-summary"
    },
    {
      "id": "template-option:region/content-block/HIDDENHEADERNOAT",
      "name": "HIDDENHEADERNOAT",
      "label": "Hidden",
      "cssClasses": [
        "t-Region--removeHeader js-removeLandmark"
      ],
      "groupId": "template-group:region/header",
      "templateTypes": [
        "REGION"
      ],
      "templates": {
        "region": "Content Block"
      },
      "virtualTemplateType": "REGION",
      "advanced": false,
      "sourceHasHelp": false,
      "description": "Hidden: applies t-Region--removeHeader js-removeLandmark within its option group.",
      "descriptionOrigin": "apexrest-factual-summary"
    },
    {
      "id": "template-option:region/content-block/HIDEREGIONHEADER",
      "name": "HIDEREGIONHEADER",
      "label": "Hidden but accessible",
      "cssClasses": [
        "t-ContentBlock--hideHeader js-addHiddenHeadingRoleDesc"
      ],
      "groupId": "template-group:region/header",
      "templateTypes": [
        "REGION"
      ],
      "templates": {
        "region": "Content Block"
      },
      "virtualTemplateType": "REGION",
      "advanced": false,
      "sourceHasHelp": true,
      "description": "This option will hide the region header. Note that the region title will still be audible for Screen Readers. Buttons placed in the region header will be hidden and inaccessible.",
      "descriptionOrigin": "oracle-upl"
    },
    {
      "id": "template-option:region/content-block/LIGHT_BACKGROUND",
      "name": "LIGHT_BACKGROUND",
      "label": "Light Background",
      "cssClasses": [
        "t-ContentBlock--lightBG"
      ],
      "groupId": "template-group:region/body-style",
      "templateTypes": [
        "REGION"
      ],
      "templates": {
        "region": "Content Block"
      },
      "virtualTemplateType": "REGION",
      "advanced": false,
      "sourceHasHelp": true,
      "description": "Gives the region body a slightly lighter background.",
      "descriptionOrigin": "oracle-upl"
    },
    {
      "id": "template-option:region/content-block/SHADOW_BACKGROUND",
      "name": "SHADOW_BACKGROUND",
      "label": "Shadow Background",
      "cssClasses": [
        "t-ContentBlock--shadowBG"
      ],
      "groupId": "template-group:region/body-style",
      "templateTypes": [
        "REGION"
      ],
      "templates": {
        "region": "Content Block"
      },
      "virtualTemplateType": "REGION",
      "advanced": false,
      "sourceHasHelp": true,
      "description": "Gives the region body a slightly darker background.",
      "descriptionOrigin": "oracle-upl"
    },
    {
      "id": "template-option:region/content-block/SHOW_REGION_ICON",
      "name": "SHOW_REGION_ICON",
      "label": "Show Region Icon",
      "cssClasses": [
        "t-ContentBlock--showIcon"
      ],
      "groupId": null,
      "templateTypes": [
        "REGION"
      ],
      "templates": {
        "region": "Content Block"
      },
      "virtualTemplateType": "REGION",
      "advanced": false,
      "sourceHasHelp": true,
      "description": "Displays the region icon in the region header beside the region title",
      "descriptionOrigin": "oracle-upl"
    },
    {
      "id": "template-option:REGION/FORMLEFTLABELS",
      "name": "FORMLEFTLABELS",
      "label": "Left",
      "cssClasses": [
        "t-Form--leftLabels"
      ],
      "groupId": "template-group:region/label-alignment",
      "templateTypes": [
        "REGION"
      ],
      "templates": {},
      "virtualTemplateType": "REGION",
      "advanced": false,
      "sourceHasHelp": true,
      "description": "Align form labels to left.",
      "descriptionOrigin": "oracle-upl"
    },
    {
      "id": "template-option:REGION/FORMREMOVEPADDING",
      "name": "FORMREMOVEPADDING",
      "label": "None",
      "cssClasses": [
        "t-Form--noPadding"
      ],
      "groupId": "template-group:region/item-padding",
      "templateTypes": [
        "REGION"
      ],
      "templates": {},
      "virtualTemplateType": "REGION",
      "advanced": false,
      "sourceHasHelp": true,
      "description": "Removes spacing between items.",
      "descriptionOrigin": "oracle-upl"
    },
    {
      "id": "template-option:REGION/FORMSIZELARGE",
      "name": "FORMSIZELARGE",
      "label": "Large",
      "cssClasses": [
        "t-Form--large"
      ],
      "groupId": "template-group:region/item-size",
      "templateTypes": [
        "REGION"
      ],
      "templates": {},
      "virtualTemplateType": "REGION",
      "advanced": false,
      "sourceHasHelp": false,
      "description": "Large: applies t-Form--large within its option group.",
      "descriptionOrigin": "apexrest-factual-summary"
    },
    {
      "id": "template-option:REGION/FORMSIZEXLARGE",
      "name": "FORMSIZEXLARGE",
      "label": "X Large",
      "cssClasses": [
        "t-Form--xlarge"
      ],
      "groupId": "template-group:region/item-size",
      "templateTypes": [
        "REGION"
      ],
      "templates": {},
      "virtualTemplateType": "REGION",
      "advanced": false,
      "sourceHasHelp": false,
      "description": "X Large: applies t-Form--xlarge within its option group.",
      "descriptionOrigin": "apexrest-factual-summary"
    },
    {
      "id": "template-option:REGION/FORMSLIMPADDING",
      "name": "FORMSLIMPADDING",
      "label": "Slim",
      "cssClasses": [
        "t-Form--slimPadding"
      ],
      "groupId": "template-group:region/item-padding",
      "templateTypes": [
        "REGION"
      ],
      "templates": {},
      "virtualTemplateType": "REGION",
      "advanced": false,
      "sourceHasHelp": true,
      "description": "Reduces form item spacing.",
      "descriptionOrigin": "oracle-upl"
    },
    {
      "id": "template-option:REGION/FORMSTANDARDPADDING",
      "name": "FORMSTANDARDPADDING",
      "label": "Standard",
      "cssClasses": [
        "t-Form--standardPadding"
      ],
      "groupId": "template-group:region/item-padding",
      "templateTypes": [
        "REGION"
      ],
      "templates": {},
      "virtualTemplateType": "REGION",
      "advanced": false,
      "sourceHasHelp": true,
      "description": "Uses the standard spacing between items.",
      "descriptionOrigin": "oracle-upl"
    },
    {
      "id": "template-option:REGION/H4",
      "name": "H4",
      "label": "H4",
      "cssClasses": [
        "js-headingLevel-4"
      ],
      "groupId": "template-group:region/heading-level",
      "templateTypes": [
        "REGION"
      ],
      "templates": {},
      "virtualTemplateType": "REGION",
      "advanced": false,
      "sourceHasHelp": true,
      "description": "H4",
      "descriptionOrigin": "oracle-upl"
    },
    {
      "id": "template-option:REGION/HEADING_LEVEL_H1",
      "name": "HEADING_LEVEL_H1",
      "label": "H1",
      "cssClasses": [
        "js-headingLevel-1"
      ],
      "groupId": "template-group:region/heading-level",
      "templateTypes": [
        "REGION"
      ],
      "templates": {},
      "virtualTemplateType": "REGION",
      "advanced": false,
      "sourceHasHelp": true,
      "description": "H1",
      "descriptionOrigin": "oracle-upl"
    },
    {
      "id": "template-option:REGION/HEADING_LEVEL_H2",
      "name": "HEADING_LEVEL_H2",
      "label": "H2",
      "cssClasses": [
        "js-headingLevel-2"
      ],
      "groupId": "template-group:region/heading-level",
      "templateTypes": [
        "REGION"
      ],
      "templates": {},
      "virtualTemplateType": "REGION",
      "advanced": false,
      "sourceHasHelp": true,
      "description": "H2",
      "descriptionOrigin": "oracle-upl"
    },
    {
      "id": "template-option:REGION/HEADING_LEVEL_H3",
      "name": "HEADING_LEVEL_H3",
      "label": "H3",
      "cssClasses": [
        "js-headingLevel-3"
      ],
      "groupId": "template-group:region/heading-level",
      "templateTypes": [
        "REGION"
      ],
      "templates": {},
      "virtualTemplateType": "REGION",
      "advanced": false,
      "sourceHasHelp": true,
      "description": "H3",
      "descriptionOrigin": "oracle-upl"
    },
    {
      "id": "template-option:REGION/HEADING_LEVEL_H5",
      "name": "HEADING_LEVEL_H5",
      "label": "H5",
      "cssClasses": [
        "js-headingLevel-5"
      ],
      "groupId": "template-group:region/heading-level",
      "templateTypes": [
        "REGION"
      ],
      "templates": {},
      "virtualTemplateType": "REGION",
      "advanced": false,
      "sourceHasHelp": true,
      "description": "H5",
      "descriptionOrigin": "oracle-upl"
    },
    {
      "id": "template-option:REGION/HEADING_LEVEL_H6",
      "name": "HEADING_LEVEL_H6",
      "label": "H6",
      "cssClasses": [
        "js-headingLevel-6"
      ],
      "groupId": "template-group:region/heading-level",
      "templateTypes": [
        "REGION"
      ],
      "templates": {},
      "virtualTemplateType": "REGION",
      "advanced": false,
      "sourceHasHelp": true,
      "description": "H6",
      "descriptionOrigin": "oracle-upl"
    },
    {
      "id": "template-option:REGION/RBM_LARGE",
      "name": "RBM_LARGE",
      "label": "Large",
      "cssClasses": [
        "margin-bottom-lg"
      ],
      "groupId": "template-group:region/region-bottom-margin",
      "templateTypes": [
        "REGION"
      ],
      "templates": {},
      "virtualTemplateType": "REGION",
      "advanced": false,
      "sourceHasHelp": true,
      "description": "Adds a large bottom margin to the region.",
      "descriptionOrigin": "oracle-upl"
    },
    {
      "id": "template-option:REGION/RBM_MEDIUM",
      "name": "RBM_MEDIUM",
      "label": "Medium",
      "cssClasses": [
        "margin-bottom-md"
      ],
      "groupId": "template-group:region/region-bottom-margin",
      "templateTypes": [
        "REGION"
      ],
      "templates": {},
      "virtualTemplateType": "REGION",
      "advanced": false,
      "sourceHasHelp": true,
      "description": "Adds a medium bottom margin to the region.",
      "descriptionOrigin": "oracle-upl"
    },
    {
      "id": "template-option:REGION/RBM_NONE",
      "name": "RBM_NONE",
      "label": "None",
      "cssClasses": [
        "margin-bottom-none"
      ],
      "groupId": "template-group:region/region-bottom-margin",
      "templateTypes": [
        "REGION"
      ],
      "templates": {},
      "virtualTemplateType": "REGION",
      "advanced": false,
      "sourceHasHelp": true,
      "description": "Removes the bottom margin for this region.",
      "descriptionOrigin": "oracle-upl"
    },
    {
      "id": "template-option:REGION/RBM_SMALL",
      "name": "RBM_SMALL",
      "label": "Small",
      "cssClasses": [
        "margin-bottom-sm"
      ],
      "groupId": "template-group:region/region-bottom-margin",
      "templateTypes": [
        "REGION"
      ],
      "templates": {},
      "virtualTemplateType": "REGION",
      "advanced": false,
      "sourceHasHelp": true,
      "description": "Adds a small bottom margin to the region.",
      "descriptionOrigin": "oracle-upl"
    },
    {
      "id": "template-option:REGION/RLM_LARGE",
      "name": "RLM_LARGE",
      "label": "Large",
      "cssClasses": [
        "margin-left-lg"
      ],
      "groupId": "template-group:region/region-left-margin",
      "templateTypes": [
        "REGION"
      ],
      "templates": {},
      "virtualTemplateType": "REGION",
      "advanced": false,
      "sourceHasHelp": true,
      "description": "Adds a large right margin to the region.",
      "descriptionOrigin": "oracle-upl"
    },
    {
      "id": "template-option:REGION/RLM_MEDIUM",
      "name": "RLM_MEDIUM",
      "label": "Medium",
      "cssClasses": [
        "margin-left-md"
      ],
      "groupId": "template-group:region/region-left-margin",
      "templateTypes": [
        "REGION"
      ],
      "templates": {},
      "virtualTemplateType": "REGION",
      "advanced": false,
      "sourceHasHelp": true,
      "description": "Adds a medium right margin to the region.",
      "descriptionOrigin": "oracle-upl"
    },
    {
      "id": "template-option:REGION/RLM_NONE",
      "name": "RLM_NONE",
      "label": "None",
      "cssClasses": [
        "margin-left-none"
      ],
      "groupId": "template-group:region/region-left-margin",
      "templateTypes": [
        "REGION"
      ],
      "templates": {},
      "virtualTemplateType": "REGION",
      "advanced": false,
      "sourceHasHelp": true,
      "description": "Removes the left margin from the region.",
      "descriptionOrigin": "oracle-upl"
    },
    {
      "id": "template-option:REGION/RLM_SMALL",
      "name": "RLM_SMALL",
      "label": "Small",
      "cssClasses": [
        "margin-left-sm"
      ],
      "groupId": "template-group:region/region-left-margin",
      "templateTypes": [
        "REGION"
      ],
      "templates": {},
      "virtualTemplateType": "REGION",
      "advanced": false,
      "sourceHasHelp": true,
      "description": "Adds a small left margin to the region.",
      "descriptionOrigin": "oracle-upl"
    },
    {
      "id": "template-option:REGION/RRM_LARGE",
      "name": "RRM_LARGE",
      "label": "Large",
      "cssClasses": [
        "margin-right-lg"
      ],
      "groupId": "template-group:region/region-right-margin",
      "templateTypes": [
        "REGION"
      ],
      "templates": {},
      "virtualTemplateType": "REGION",
      "advanced": false,
      "sourceHasHelp": true,
      "description": "Adds a large right margin to the region.",
      "descriptionOrigin": "oracle-upl"
    },
    {
      "id": "template-option:REGION/RRM_MEDIUM",
      "name": "RRM_MEDIUM",
      "label": "Medium",
      "cssClasses": [
        "margin-right-md"
      ],
      "groupId": "template-group:region/region-right-margin",
      "templateTypes": [
        "REGION"
      ],
      "templates": {},
      "virtualTemplateType": "REGION",
      "advanced": false,
      "sourceHasHelp": true,
      "description": "Adds a medium right margin to the region.",
      "descriptionOrigin": "oracle-upl"
    },
    {
      "id": "template-option:REGION/RRM_NONE",
      "name": "RRM_NONE",
      "label": "None",
      "cssClasses": [
        "margin-right-none"
      ],
      "groupId": "template-group:region/region-right-margin",
      "templateTypes": [
        "REGION"
      ],
      "templates": {},
      "virtualTemplateType": "REGION",
      "advanced": false,
      "sourceHasHelp": true,
      "description": "Removes the right margin from the region.",
      "descriptionOrigin": "oracle-upl"
    },
    {
      "id": "template-option:REGION/RRM_SMALL",
      "name": "RRM_SMALL",
      "label": "Small",
      "cssClasses": [
        "margin-right-sm"
      ],
      "groupId": "template-group:region/region-right-margin",
      "templateTypes": [
        "REGION"
      ],
      "templates": {},
      "virtualTemplateType": "REGION",
      "advanced": false,
      "sourceHasHelp": true,
      "description": "Adds a small right margin to the region.",
      "descriptionOrigin": "oracle-upl"
    },
    {
      "id": "template-option:REGION/RTM_LARGE",
      "name": "RTM_LARGE",
      "label": "Large",
      "cssClasses": [
        "margin-top-lg"
      ],
      "groupId": "template-group:region/region-top-margin",
      "templateTypes": [
        "REGION"
      ],
      "templates": {},
      "virtualTemplateType": "REGION",
      "advanced": false,
      "sourceHasHelp": true,
      "description": "Adds a large top margin to the region.",
      "descriptionOrigin": "oracle-upl"
    },
    {
      "id": "template-option:REGION/RTM_MEDIUM",
      "name": "RTM_MEDIUM",
      "label": "Medium",
      "cssClasses": [
        "margin-top-md"
      ],
      "groupId": "template-group:region/region-top-margin",
      "templateTypes": [
        "REGION"
      ],
      "templates": {},
      "virtualTemplateType": "REGION",
      "advanced": false,
      "sourceHasHelp": true,
      "description": "Adds a medium top margin to the region.",
      "descriptionOrigin": "oracle-upl"
    },
    {
      "id": "template-option:REGION/RTM_NONE",
      "name": "RTM_NONE",
      "label": "None",
      "cssClasses": [
        "margin-top-none"
      ],
      "groupId": "template-group:region/region-top-margin",
      "templateTypes": [
        "REGION"
      ],
      "templates": {},
      "virtualTemplateType": "REGION",
      "advanced": false,
      "sourceHasHelp": true,
      "description": "Removes the top margin for this region.",
      "descriptionOrigin": "oracle-upl"
    },
    {
      "id": "template-option:REGION/RTM_SMALL",
      "name": "RTM_SMALL",
      "label": "Small",
      "cssClasses": [
        "margin-top-sm"
      ],
      "groupId": "template-group:region/region-top-margin",
      "templateTypes": [
        "REGION"
      ],
      "templates": {},
      "virtualTemplateType": "REGION",
      "advanced": false,
      "sourceHasHelp": true,
      "description": "Adds a small top margin to the region.",
      "descriptionOrigin": "oracle-upl"
    },
    {
      "id": "template-option:REGION/SHOWFORMLABELSABOVE",
      "name": "SHOWFORMLABELSABOVE",
      "label": "Show Form Labels Above",
      "cssClasses": [
        "t-Form--labelsAbove"
      ],
      "groupId": "template-group:region/label-position",
      "templateTypes": [
        "REGION"
      ],
      "templates": {},
      "virtualTemplateType": "REGION",
      "advanced": false,
      "sourceHasHelp": true,
      "description": "Show form labels above input fields.",
      "descriptionOrigin": "oracle-upl"
    },
    {
      "id": "template-option:REGION/SORT_CENTER",
      "name": "SORT_CENTER",
      "label": "Center",
      "cssClasses": [
        "t-Region-orderBy--center"
      ],
      "groupId": "template-group:region/sort-order-alignment",
      "templateTypes": [
        "REGION"
      ],
      "templates": {},
      "virtualTemplateType": "REGION",
      "advanced": false,
      "sourceHasHelp": false,
      "description": "Center: applies t-Region-orderBy--center within its option group.",
      "descriptionOrigin": "apexrest-factual-summary"
    },
    {
      "id": "template-option:REGION/SORT_END",
      "name": "SORT_END",
      "label": "End",
      "cssClasses": [
        "t-Region-orderBy--end"
      ],
      "groupId": "template-group:region/sort-order-alignment",
      "templateTypes": [
        "REGION"
      ],
      "templates": {},
      "virtualTemplateType": "REGION",
      "advanced": false,
      "sourceHasHelp": false,
      "description": "End: applies t-Region-orderBy--end within its option group.",
      "descriptionOrigin": "apexrest-factual-summary"
    },
    {
      "id": "template-option:REGION/STRETCH_FORM_FIELDS",
      "name": "STRETCH_FORM_FIELDS",
      "label": "Stretch Form Fields",
      "cssClasses": [
        "t-Form--stretchInputs"
      ],
      "groupId": "template-group:region/item-width",
      "templateTypes": [
        "REGION"
      ],
      "templates": {},
      "virtualTemplateType": "REGION",
      "advanced": false,
      "sourceHasHelp": false,
      "description": "Stretch Form Fields: applies t-Form--stretchInputs within its option group.",
      "descriptionOrigin": "apexrest-factual-summary"
    }
  ],
  "templateOptionGroups": [
    {
      "id": "template-group:region/body-style",
      "sourceId": "3602683372547405325",
      "name": "BODY_STYLE",
      "label": "Body Style",
      "templateTypes": [
        "REGION"
      ],
      "nullText": "Default",
      "advanced": false,
      "sourceHasHelp": true,
      "description": "Controls the display of the region's body container.",
      "descriptionOrigin": "oracle-upl"
    },
    {
      "id": "template-group:region/header",
      "sourceId": "2137435470226345390",
      "name": "HEADER",
      "label": "Header",
      "templateTypes": [
        "REGION"
      ],
      "nullText": "Visible - Default",
      "advanced": false,
      "sourceHasHelp": true,
      "description": "Determines the display of the Region Header which also contains the Region Title.",
      "descriptionOrigin": "oracle-upl"
    },
    {
      "id": "template-group:region/heading-font",
      "sourceId": "2074800559029856815",
      "name": "HEADING_FONT",
      "label": "Heading Font",
      "templateTypes": [
        "REGION"
      ],
      "nullText": "Default",
      "advanced": false,
      "sourceHasHelp": true,
      "description": "Sets the font-family of the heading for this region.",
      "descriptionOrigin": "oracle-upl"
    },
    {
      "id": "template-group:region/heading-level",
      "sourceId": "1854688978004436212",
      "name": "HEADING_LEVEL",
      "label": "Heading Level",
      "templateTypes": [
        "REGION"
      ],
      "nullText": "Default",
      "advanced": true,
      "sourceHasHelp": false,
      "description": "Heading Level choices for REGION templates.",
      "descriptionOrigin": "apexrest-factual-summary"
    },
    {
      "id": "template-group:region/item-padding",
      "sourceId": "2137440444399345391",
      "name": "ITEM_PADDING",
      "label": "Item Spacing",
      "templateTypes": [
        "REGION"
      ],
      "nullText": "Default",
      "advanced": true,
      "sourceHasHelp": true,
      "description": "Sets the padding around items within this region.",
      "descriptionOrigin": "oracle-upl"
    },
    {
      "id": "template-group:region/item-size",
      "sourceId": "2137436858184345391",
      "name": "ITEM_SIZE",
      "label": "Item Size",
      "templateTypes": [
        "REGION"
      ],
      "nullText": "Default",
      "advanced": true,
      "sourceHasHelp": true,
      "description": "Sets the size of the form items within this region.",
      "descriptionOrigin": "oracle-upl"
    },
    {
      "id": "template-group:region/item-width",
      "sourceId": "2668408922155612292",
      "name": "ITEM_WIDTH",
      "label": "Item Width",
      "templateTypes": [
        "REGION"
      ],
      "nullText": "Default",
      "advanced": true,
      "sourceHasHelp": true,
      "description": "Sets the width of the form items within this region.",
      "descriptionOrigin": "oracle-upl"
    },
    {
      "id": "template-group:region/label-alignment",
      "sourceId": "2391464006887948702",
      "name": "LABEL_ALIGNMENT",
      "label": "Label Alignment",
      "templateTypes": [
        "REGION"
      ],
      "nullText": "Right",
      "advanced": true,
      "sourceHasHelp": true,
      "description": "Set the label text alignment for items within this region.",
      "descriptionOrigin": "oracle-upl"
    },
    {
      "id": "template-group:region/label-position",
      "sourceId": "2391484669664981331",
      "name": "LABEL_POSITION",
      "label": "Label Position",
      "templateTypes": [
        "REGION"
      ],
      "nullText": "Inline - Default",
      "advanced": true,
      "sourceHasHelp": true,
      "description": "Sets the position of the label relative to the form item.",
      "descriptionOrigin": "oracle-upl"
    },
    {
      "id": "template-group:region/region-bottom-margin",
      "sourceId": "2498706129862154232",
      "name": "REGION_BOTTOM_MARGIN",
      "label": "Bottom Margin",
      "templateTypes": [
        "REGION"
      ],
      "nullText": "Default",
      "advanced": true,
      "sourceHasHelp": true,
      "description": "Set the bottom margin for this region.",
      "descriptionOrigin": "oracle-upl"
    },
    {
      "id": "template-group:region/region-left-margin",
      "sourceId": "2498708184263162223",
      "name": "REGION_LEFT_MARGIN",
      "label": "Left Margin",
      "templateTypes": [
        "REGION"
      ],
      "nullText": "Default",
      "advanced": true,
      "sourceHasHelp": true,
      "description": "Set the left margin for this region.",
      "descriptionOrigin": "oracle-upl"
    },
    {
      "id": "template-group:region/region-right-margin",
      "sourceId": "2498708543998164599",
      "name": "REGION_RIGHT_MARGIN",
      "label": "Right Margin",
      "templateTypes": [
        "REGION"
      ],
      "nullText": "Default",
      "advanced": true,
      "sourceHasHelp": true,
      "description": "Set the right margin for this region.",
      "descriptionOrigin": "oracle-upl"
    },
    {
      "id": "template-group:region/region-title",
      "sourceId": "2791863012574857184",
      "name": "REGION_TITLE",
      "label": "Region Title",
      "templateTypes": [
        "REGION"
      ],
      "advanced": false,
      "sourceHasHelp": true,
      "description": "Sets the source of the Title Bar region's title.",
      "descriptionOrigin": "oracle-upl"
    },
    {
      "id": "template-group:region/region-top-margin",
      "sourceId": "2498705575576152458",
      "name": "REGION_TOP_MARGIN",
      "label": "Top Margin",
      "templateTypes": [
        "REGION"
      ],
      "nullText": "Default",
      "advanced": true,
      "sourceHasHelp": true,
      "description": "Set the top margin for this region.",
      "descriptionOrigin": "oracle-upl"
    },
    {
      "id": "template-group:region/sort-order-alignment",
      "sourceId": "1611377962267616972",
      "name": "SORT_ORDER_ALIGNMENT",
      "label": "Sort Order Alignment",
      "templateTypes": [
        "REGION"
      ],
      "nullText": "Default (Start)",
      "advanced": true,
      "sourceHasHelp": true,
      "description": "Sets the alignment of the sort order item.",
      "descriptionOrigin": "oracle-upl"
    }
  ],
  "templateDefaults": [
    {
      "id": "region-template:content-block",
      "type": "region",
      "name": "Content Block",
      "key": "content-block",
      "internalName": "CONTENT_BLOCK",
      "defaultOptions": [],
      "presetOptions": [
        "t-ContentBlock--h1"
      ]
    }
  ],
  "utAttributes": [],
  "utAttributeValues": [],
  "nativeParameters": [
    {
      "id": "mmd:5110:1",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "1",
      "builderLabel": "Name",
      "apexlangPath": "region.name",
      "type": "TEXT",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": null,
      "maxLength": 255,
      "description": "Name (text) in region.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:4",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "4",
      "builderLabel": "Comments",
      "apexlangPath": "region.comments.comments",
      "type": "TEXT EDITOR",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": null,
      "maxLength": 4000,
      "description": "Comments (text editor) in region.comments.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:13",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "13",
      "builderLabel": "Title",
      "apexlangPath": "region.title",
      "type": "TEXT",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": null,
      "maxLength": 255,
      "description": "Title (text) in region.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:21",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "21",
      "builderLabel": "Header Text",
      "apexlangPath": "region.headerAndFooter.headerText",
      "type": "HTML",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "FEATURES",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "REGION_TEMPLATE"
            ]
          }
        ]
      },
      "maxLength": 4000,
      "description": "Header Text (html) in region.headerAndFooter.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:23",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "23",
      "builderLabel": "Footer Text",
      "apexlangPath": "region.headerAndFooter.footerText",
      "type": "HTML",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "FEATURES",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "REGION_TEMPLATE"
            ]
          }
        ]
      },
      "maxLength": 4000,
      "description": "Footer Text (html) in region.headerAndFooter.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:24",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "24",
      "builderLabel": "Authorization Scheme",
      "apexlangPath": "region.security.authorizationScheme",
      "type": "COMPONENT",
      "required": false,
      "defaultValue": null,
      "values": [
        {
          "name": "mustNotBePublicUser",
          "returnValue": "MUST_NOT_BE_PUBLIC_USER",
          "label": "MODEL.LOV.MUST_NOT_BE_PUBLIC_USER"
        }
      ],
      "condition": null,
      "maxLength": null,
      "description": "Authorization Scheme (component) in region.security.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:32",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "32",
      "builderLabel": "Cache Timeout",
      "apexlangPath": "region.serverCache.cacheTimeout",
      "type": "SELECT LIST",
      "required": true,
      "defaultValue": "21600",
      "values": [
        {
          "name": "10Seconds",
          "returnValue": "10",
          "label": "10 seconds"
        },
        {
          "name": "1Minute",
          "returnValue": "60",
          "label": "1 minute"
        },
        {
          "name": "10Minutes",
          "returnValue": "600",
          "label": "10 minutes"
        },
        {
          "name": "30Minutes",
          "returnValue": "1800",
          "label": "30 minutes"
        },
        {
          "name": "1Hour",
          "returnValue": "3600",
          "label": "1 hour"
        },
        {
          "name": "2Hours",
          "returnValue": "7200",
          "label": "2 hours"
        },
        {
          "name": "3Hours",
          "returnValue": "10800",
          "label": "3 hours"
        },
        {
          "name": "4Hours",
          "returnValue": "14400",
          "label": "4 hours"
        },
        {
          "name": "6Hours",
          "returnValue": "21600",
          "label": "6 hours"
        },
        {
          "name": "12Hours",
          "returnValue": "43200",
          "label": "12 hours"
        },
        {
          "name": "1Day",
          "returnValue": "86400",
          "label": "1 day"
        },
        {
          "name": "2Days",
          "returnValue": "172800",
          "label": "2 days"
        },
        {
          "name": "3Days",
          "returnValue": "259200",
          "label": "3 days"
        },
        {
          "name": "4Days",
          "returnValue": "345600",
          "label": "4 days"
        },
        {
          "name": "1Week",
          "returnValue": "604800",
          "label": "1 week"
        },
        {
          "name": "2Weeks",
          "returnValue": "1209600",
          "label": "2 weeks"
        },
        {
          "name": "4Weeks",
          "returnValue": "2419200",
          "label": "4 Weeks"
        },
        {
          "name": "10Weeks",
          "returnValue": "6048000",
          "label": "10 Weeks"
        },
        {
          "name": "1Year",
          "returnValue": "31536000",
          "label": "1 Year"
        }
      ],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_EQUALS",
            "propertyId": "222",
            "path": "region.serverCache.caching",
            "hasToExist": true,
            "value": "NOCACHE"
          }
        ]
      },
      "maxLength": null,
      "description": "Cache Timeout (select list) in region.serverCache.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:38",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "38",
      "builderLabel": "Build Option",
      "apexlangPath": "region.config.buildOption",
      "type": "COMPONENT",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": null,
      "maxLength": null,
      "description": "Build Option (component) in region.config.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:94",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "94",
      "builderLabel": "Type",
      "apexlangPath": "region.type",
      "type": "SUPPORTED UI",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": null,
      "maxLength": null,
      "description": "Type (supported ui) in region.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:97",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "97",
      "builderLabel": "Sequence",
      "apexlangPath": "region.layout.sequence",
      "type": "NUMBER",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": null,
      "maxLength": 22,
      "description": "Sequence (number) in region.layout.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:104",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "104",
      "builderLabel": "Start New Layout",
      "apexlangPath": "region.layout.startNewLayout",
      "type": "YES NO",
      "required": true,
      "defaultValue": "N",
      "values": [],
      "condition": null,
      "maxLength": 32767,
      "description": "Start New Layout (yes no) in region.layout.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:105",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "105",
      "builderLabel": "Start New Row",
      "apexlangPath": "region.layout.startNewRow",
      "type": "YES NO",
      "required": true,
      "defaultValue": "Y",
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "104",
            "path": "region.layout.startNewLayout",
            "hasToExist": false,
            "value": "N"
          }
        ]
      },
      "maxLength": 32767,
      "description": "Start New Row (yes no) in region.layout.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:106",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "106",
      "builderLabel": "Column",
      "apexlangPath": "region.layout.column",
      "type": "SELECT LIST",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": null,
      "maxLength": null,
      "description": "Column (select list) in region.layout.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:107",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "107",
      "builderLabel": "New Column",
      "apexlangPath": "region.layout.newColumn",
      "type": "YES NO",
      "required": true,
      "defaultValue": "Y",
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "105",
            "path": "region.layout.startNewRow",
            "hasToExist": false,
            "value": "N"
          }
        ]
      },
      "maxLength": 32767,
      "description": "New Column (yes no) in region.layout.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:108",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "108",
      "builderLabel": "Column Span",
      "apexlangPath": "region.layout.columnSpan",
      "type": "SELECT LIST",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": null,
      "maxLength": null,
      "description": "Column Span (select list) in region.layout.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:110",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "110",
      "builderLabel": "Column Attributes",
      "apexlangPath": "region.layout.columnAttributes",
      "type": "COMBOBOX",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": null,
      "maxLength": 255,
      "description": "Column Attributes (combobox) in region.layout.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:129",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "129",
      "builderLabel": "Custom Attributes",
      "apexlangPath": "region.advanced.customAttributes",
      "type": "COMBOBOX",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "FEATURES",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "REGION_TEMPLATE"
            ]
          }
        ]
      },
      "maxLength": 2000,
      "description": "Custom Attributes (combobox) in region.advanced.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:174",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "174",
      "builderLabel": "Escape Special Characters",
      "apexlangPath": "region.security.escapeSpecialChars",
      "type": "YES NO",
      "required": true,
      "defaultValue": "Y",
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "FEATURES",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "ESCAPE_OUTPUT"
            ]
          }
        ]
      },
      "maxLength": 32767,
      "description": "Escape Special Characters (yes no) in region.security.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:180",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "180",
      "builderLabel": "Static ID",
      "apexlangPath": "region.advanced.staticId",
      "type": "STATIC ID",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": null,
      "maxLength": 255,
      "description": "Static ID (static id) in region.advanced.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:181",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "181",
      "builderLabel": "HTML DOM ID",
      "apexlangPath": "region.advanced.htmlDomId",
      "type": "TEXT",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": null,
      "maxLength": 255,
      "description": "HTML DOM ID (text) in region.advanced.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:190",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "190",
      "builderLabel": "Parent Region",
      "apexlangPath": "region.layout.parentRegion",
      "type": "COMPONENT",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": null,
      "maxLength": null,
      "description": "Parent Region (component) in region.layout.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:191",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "191",
      "builderLabel": "Slot",
      "apexlangPath": "region.layout.slot",
      "type": "SELECT LIST",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": null,
      "maxLength": null,
      "description": "Slot (select list) in region.layout.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:193",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "193",
      "builderLabel": "SQL Query",
      "apexlangPath": "region.source.sqlQuery",
      "type": "SQL",
      "required": {
        "operator": "AND",
        "conditions": [
          {
            "type": "FEATURE_IS_REQUIRED",
            "hasToExist": true,
            "value": "SOURCE_SQL",
            "propertyId": "94"
          }
        ]
      },
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "FEATURES",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "SOURCE_SQL"
            ]
          }
        ]
      },
      "maxLength": 32767,
      "description": "SQL Query (sql) in region.source.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:194",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "194",
      "builderLabel": "Text",
      "apexlangPath": "region.source.text",
      "type": "TEXT EDITOR",
      "required": {
        "operator": "AND",
        "conditions": [
          {
            "type": "FEATURE_IS_REQUIRED",
            "hasToExist": true,
            "value": "SOURCE_PLAIN",
            "propertyId": "94"
          }
        ]
      },
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "FEATURES",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "SOURCE_PLAIN"
            ]
          }
        ]
      },
      "maxLength": 32767,
      "description": "Text (text editor) in region.source.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:198",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "198",
      "builderLabel": "PL/SQL Code",
      "apexlangPath": "region.source.plsqlCode",
      "type": "PLSQL",
      "required": {
        "operator": "AND",
        "conditions": [
          {
            "type": "FEATURE_IS_REQUIRED",
            "hasToExist": true,
            "value": "SOURCE_PLSQL",
            "propertyId": "94"
          }
        ]
      },
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "FEATURES",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "SOURCE_PLSQL"
            ]
          }
        ]
      },
      "maxLength": 32767,
      "description": "PL/SQL Code (plsql) in region.source.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:213",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "213",
      "builderLabel": "Exclude Title from Translation",
      "apexlangPath": "region.advanced.excludeTitleFromTranslation",
      "type": "YES NO",
      "required": true,
      "defaultValue": "N",
      "values": [],
      "condition": null,
      "maxLength": 32767,
      "description": "Exclude Title from Translation (yes no) in region.advanced.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:214",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "214",
      "builderLabel": "HTML Code",
      "apexlangPath": "region.source.htmlCode",
      "type": "HTML",
      "required": {
        "operator": "AND",
        "conditions": [
          {
            "type": "FEATURE_IS_REQUIRED",
            "hasToExist": true,
            "value": "SOURCE_HTML",
            "propertyId": "94"
          }
        ]
      },
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "FEATURES",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "SOURCE_HTML"
            ]
          }
        ]
      },
      "maxLength": 32767,
      "description": "HTML Code (html) in region.source.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:215",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "215",
      "builderLabel": "Page Items to Submit",
      "apexlangPath": "region.source.pageItemsToSubmit",
      "type": "ITEM",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "FEATURES",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "AJAX_ITEMS_TO_SUBMIT"
            ]
          }
        ]
      },
      "maxLength": 4000,
      "description": "Page Items to Submit (item) in region.source.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:217",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "217",
      "builderLabel": "Template",
      "apexlangPath": "region.appearance.template",
      "type": "COMPONENT",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "FEATURES",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "REGION_TEMPLATE"
            ]
          }
        ]
      },
      "maxLength": null,
      "description": "Template (component) in region.appearance.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:218",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "218",
      "builderLabel": "Render Components",
      "apexlangPath": "region.appearance.renderComponents",
      "type": "SELECT LIST",
      "required": true,
      "defaultValue": "ABOVE",
      "values": [
        {
          "name": "aboveContent",
          "returnValue": "ABOVE",
          "label": "Above Content"
        },
        {
          "name": "belowContent",
          "returnValue": "BELOW",
          "label": "Below Content"
        }
      ],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "FEATURES",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "REGION_TEMPLATE"
            ]
          }
        ]
      },
      "maxLength": null,
      "description": "Render Components (select list) in region.appearance.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:219",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "219",
      "builderLabel": "Region Display Selector",
      "apexlangPath": "region.advanced.regionDisplaySelector",
      "type": "YES NO",
      "required": true,
      "defaultValue": "N",
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_NULL",
            "propertyId": "217",
            "path": "region.appearance.template",
            "hasToExist": false
          }
        ]
      },
      "maxLength": 32767,
      "description": "Region Display Selector (yes no) in region.advanced.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:220",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "220",
      "builderLabel": "Region Image",
      "apexlangPath": "region.advanced.regionImage",
      "type": "TEXT",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "FEATURES",
            "propertyId": "217",
            "path": "region.appearance.template",
            "hasToExist": true,
            "values": [
              "NOT_REGION_IMAGE_URL"
            ]
          }
        ]
      },
      "maxLength": 255,
      "description": "Region Image (text) in region.advanced.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:221",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "221",
      "builderLabel": "Image Tag Attributes",
      "apexlangPath": "region.advanced.imageTagAttributes",
      "type": "TEXT",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_NULL",
            "propertyId": "220",
            "path": "region.advanced.regionImage",
            "hasToExist": true
          }
        ]
      },
      "maxLength": 255,
      "description": "Image Tag Attributes (text) in region.advanced.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:222",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "222",
      "builderLabel": "Caching",
      "apexlangPath": "region.serverCache.caching",
      "type": "SELECT LIST",
      "required": true,
      "defaultValue": "NOCACHE",
      "values": [
        {
          "name": "false",
          "returnValue": "NOCACHE",
          "label": "Disabled"
        },
        {
          "name": "true",
          "returnValue": "CACHE",
          "label": "Enabled"
        },
        {
          "name": "cacheByUser",
          "returnValue": "USER",
          "label": "Cache By User"
        },
        {
          "name": "cacheBySession",
          "returnValue": "SESSION",
          "label": "Cache By Session"
        }
      ],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "STARTS_WITH_ANY",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "NATIVE_JQM_LIST_VIEW",
              "NATIVE_JQM_REFLOW",
              "NATIVE_JQM_COLUMN_TOGGLE",
              "NATIVE_LIST",
              "NATIVE_URL",
              "NATIVE_IR",
              "NATIVE_SQL_REPORT",
              "NATIVE_TABFORM",
              "NATIVE_PLSQL",
              "NATIVE_JSTREE",
              "NATIVE_CALENDAR",
              "NATIVE_SVG_CHART",
              "NATIVE_SIMPLE_CHART",
              "NATIVE_TREE",
              "NATIVE_STATIC_SEARCH",
              "NATIVE_DYNAMIC_CONTENT",
              "PLUGIN_"
            ]
          }
        ]
      },
      "maxLength": null,
      "description": "Caching (select list) in region.serverCache.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:223",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "223",
      "builderLabel": "Customizable",
      "apexlangPath": "region.customization.customizable",
      "type": "SELECT LIST",
      "required": true,
      "defaultValue": "0",
      "values": [
        {
          "name": "false",
          "returnValue": "0",
          "label": "Not Customizable By End Users"
        },
        {
          "name": "shownByDefault",
          "returnValue": "1",
          "label": "Customizable and Shown By Default"
        },
        {
          "name": "notShownByDefault",
          "returnValue": "2",
          "label": "Customizable and Not Shown By Default"
        }
      ],
      "condition": null,
      "maxLength": null,
      "description": "Customizable (select list) in region.customization.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:224",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "224",
      "builderLabel": "Name",
      "apexlangPath": "region.customization.name",
      "type": "TEXT",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "IN_LIST",
            "propertyId": "223",
            "path": "region.customization.customizable",
            "hasToExist": true,
            "values": [
              "1",
              "2"
            ]
          }
        ]
      },
      "maxLength": 255,
      "description": "Name (text) in region.customization.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:225",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "225",
      "builderLabel": "PL/SQL Function Body returning SQL Query",
      "apexlangPath": "region.source.plsqlFunctionBody",
      "type": "PLSQL FUNCTION BODY SQL",
      "required": {
        "operator": "AND",
        "conditions": [
          {
            "type": "FEATURE_IS_REQUIRED",
            "hasToExist": true,
            "value": "SOURCE_PLSQL_FUNCTION",
            "propertyId": "94"
          }
        ]
      },
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "FEATURES",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "SOURCE_PLSQL_FUNCTION"
            ]
          }
        ]
      },
      "maxLength": 32767,
      "description": "PL/SQL Function Body returning SQL Query (plsql function body sql) in region.source.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:391",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "391",
      "builderLabel": "Generic Column Count",
      "apexlangPath": "region.source.genericColumnCount",
      "type": "INTEGER",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "390",
            "path": "region.source.useGenericColumnNames",
            "hasToExist": true,
            "value": "GENERIC_REPORT_COLUMNS"
          }
        ]
      },
      "maxLength": 3,
      "description": "Generic Column Count (integer) in region.source.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:475",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "475",
      "builderLabel": "Graph Owner",
      "apexlangPath": "region.source.graphOwner",
      "type": "OWNER",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "959",
            "path": "region.source.type",
            "hasToExist": true,
            "value": "GRAPH"
          }
        ]
      },
      "maxLength": 32767,
      "description": "Graph Owner (owner) in region.source.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:476",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "476",
      "builderLabel": "Graph Name",
      "apexlangPath": "region.source.graphName",
      "type": "GRAPH",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "959",
            "path": "region.source.type",
            "hasToExist": true,
            "value": "GRAPH"
          }
        ]
      },
      "maxLength": 32767,
      "description": "Graph Name (graph) in region.source.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:477",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "477",
      "builderLabel": "Match Clause",
      "apexlangPath": "region.source.matchClause",
      "type": "TEXT EDITOR",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "959",
            "path": "region.source.type",
            "hasToExist": true,
            "value": "GRAPH"
          }
        ]
      },
      "maxLength": 4000,
      "description": "Match Clause (text editor) in region.source.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:478",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "478",
      "builderLabel": "Where Clause",
      "apexlangPath": "region.source.whereClause",
      "type": "WHERE CLAUSE",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "959",
            "path": "region.source.type",
            "hasToExist": true,
            "value": "GRAPH"
          }
        ]
      },
      "maxLength": 4000,
      "description": "Where Clause (where clause) in region.source.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:479",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "479",
      "builderLabel": "Columns Clause",
      "apexlangPath": "region.source.columnsClause",
      "type": "TEXT EDITOR",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "959",
            "path": "region.source.type",
            "hasToExist": true,
            "value": "GRAPH"
          }
        ]
      },
      "maxLength": 4000,
      "description": "Columns Clause (text editor) in region.source.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:481",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "481",
      "builderLabel": "Order By Clause",
      "apexlangPath": "region.orderBy.orderByClause",
      "type": "ORDER BY CLAUSE",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "1238",
            "path": "region.orderBy.type",
            "hasToExist": true,
            "value": "STATIC"
          },
          {
            "type": "EQUALS",
            "propertyId": "959",
            "path": "region.source.type",
            "hasToExist": true,
            "value": "GRAPH"
          }
        ]
      },
      "maxLength": 4000,
      "description": "Order By Clause (order by clause) in region.orderBy.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:482",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "482",
      "builderLabel": "Item",
      "apexlangPath": "region.orderBy.item",
      "type": "ORDER BY ITEM",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "1238",
            "path": "region.orderBy.type",
            "hasToExist": true,
            "value": "ITEM"
          },
          {
            "type": "EQUALS",
            "propertyId": "959",
            "path": "region.source.type",
            "hasToExist": true,
            "value": "GRAPH"
          }
        ]
      },
      "maxLength": 32767,
      "description": "Item (order by item) in region.orderBy.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:739",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "739",
      "builderLabel": "Icon",
      "apexlangPath": "region.appearance.icon",
      "type": "ICON",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_NULL",
            "propertyId": "217",
            "path": "region.appearance.template",
            "hasToExist": true
          }
        ]
      },
      "maxLength": 255,
      "description": "Icon (icon) in region.appearance.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:740",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "740",
      "builderLabel": "CSS Classes",
      "apexlangPath": "region.appearance.cssClasses",
      "type": "COMBOBOX",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_NULL",
            "propertyId": "217",
            "path": "region.appearance.template",
            "hasToExist": true
          }
        ]
      },
      "maxLength": 255,
      "description": "CSS Classes (combobox) in region.appearance.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:741",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "741",
      "builderLabel": "Template Options",
      "apexlangPath": "region.appearance.templateOptions",
      "type": "TEMPLATE OPTIONS",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_NULL",
            "propertyId": "217",
            "path": "region.appearance.template",
            "hasToExist": true
          }
        ]
      },
      "maxLength": null,
      "description": "Template Options (template options) in region.appearance.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:751",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "751",
      "builderLabel": "Depends On Item(s)",
      "apexlangPath": "region.serverCache.dependsOnItems",
      "type": "ITEM",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_EQUALS",
            "propertyId": "222",
            "path": "region.serverCache.caching",
            "hasToExist": true,
            "value": "NOCACHE"
          }
        ]
      },
      "maxLength": 4000,
      "description": "Depends On Item(s) (item) in region.serverCache.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:763",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "763",
      "builderLabel": "Column CSS Classes",
      "apexlangPath": "region.layout.columnCssClasses",
      "type": "COMBOBOX",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": null,
      "maxLength": 255,
      "description": "Column CSS Classes (combobox) in region.layout.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:814",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "814",
      "builderLabel": "Row CSS Classes",
      "apexlangPath": "region.layout.rowCssClasses",
      "type": "COMBOBOX",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": null,
      "maxLength": 255,
      "description": "Row CSS Classes (combobox) in region.layout.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:957",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "957",
      "builderLabel": "Location",
      "apexlangPath": "region.source.location",
      "type": "SELECT LIST",
      "required": {
        "operator": "OR",
        "conditions": [
          {
            "operator": "AND",
            "conditions": [
              {
                "type": "STARTS_WITH",
                "hasToExist": true,
                "value": "TMPL_",
                "propertyId": "94"
              },
              {
                "type": "EXISTS",
                "hasToExist": true,
                "componentTypeId": "7000",
                "condition": {
                  "operator": "AND",
                  "conditions": [
                    {
                      "type": "EQUALS",
                      "hasToExist": true,
                      "value": "REPORT",
                      "propertyId": "243"
                    }
                  ]
                }
              }
            ]
          },
          {
            "operator": "AND",
            "conditions": [
              {
                "type": "NOT_STARTS_WITH",
                "hasToExist": true,
                "value": "TMPL_",
                "propertyId": "94"
              },
              {
                "type": "FEATURE_IS_REQUIRED",
                "hasToExist": true,
                "value": "SOURCE_LOCATION",
                "propertyId": "94"
              }
            ]
          }
        ]
      },
      "defaultValue": "LOCAL",
      "values": [
        {
          "name": "localDatabase",
          "returnValue": "LOCAL",
          "label": "Local Database"
        },
        {
          "name": "restEnabledSql",
          "returnValue": "REMOTE",
          "label": "REST Enabled SQL"
        },
        {
          "name": "restSource",
          "returnValue": "WEB_SOURCE",
          "label": "REST Source"
        },
        {
          "name": "jsonDualityView",
          "returnValue": "DUALITY_VIEW",
          "label": "JSON Duality View"
        },
        {
          "name": "jsonSource",
          "returnValue": "JSON_COLLECTION",
          "label": "JSON Source"
        },
        {
          "name": "sampleData",
          "returnValue": "SAMPLE_DATA",
          "label": "Sample Data"
        }
      ],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "FEATURES",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "SOURCE_LOCATION"
            ]
          }
        ]
      },
      "maxLength": null,
      "description": "Location (select list) in region.source.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:958",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "958",
      "builderLabel": "Remote Server",
      "apexlangPath": "region.source.remoteServer",
      "type": "COMPONENT",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "957",
            "path": "region.source.location",
            "hasToExist": true,
            "value": "REMOTE"
          }
        ]
      },
      "maxLength": null,
      "description": "Remote Server (component) in region.source.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:959",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "959",
      "builderLabel": "Type",
      "apexlangPath": "region.source.type",
      "type": "SELECT LIST",
      "required": true,
      "defaultValue": "TABLE",
      "values": [
        {
          "name": "tableView",
          "returnValue": "TABLE",
          "label": "Table / View"
        },
        {
          "name": "sqlQuery",
          "returnValue": "SQL",
          "label": "SQL Query"
        },
        {
          "name": "functionBody",
          "returnValue": "FUNC_BODY_RETURNING_SQL",
          "label": "Function Body returning SQL Query"
        },
        {
          "name": "propertyGraph",
          "returnValue": "GRAPH",
          "label": "Property Graph"
        }
      ],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "IN_LIST",
            "propertyId": "957",
            "path": "region.source.location",
            "hasToExist": true,
            "values": [
              "LOCAL",
              "REMOTE"
            ]
          }
        ]
      },
      "maxLength": null,
      "description": "Type (select list) in region.source.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:960",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "960",
      "builderLabel": "Table Owner",
      "apexlangPath": "region.source.tableOwner",
      "type": "OWNER",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "959",
            "path": "region.source.type",
            "hasToExist": true,
            "value": "TABLE"
          }
        ]
      },
      "maxLength": 32767,
      "description": "Table Owner (owner) in region.source.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:961",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "961",
      "builderLabel": "Table Name",
      "apexlangPath": "region.source.tableName",
      "type": "TABLE",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "959",
            "path": "region.source.type",
            "hasToExist": true,
            "value": "TABLE"
          }
        ]
      },
      "maxLength": 128,
      "description": "Table Name (table) in region.source.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:962",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "962",
      "builderLabel": "Where Clause",
      "apexlangPath": "region.source.whereClause",
      "type": "WHERE CLAUSE",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "959",
            "path": "region.source.type",
            "hasToExist": true,
            "value": "TABLE"
          }
        ]
      },
      "maxLength": 4000,
      "description": "Where Clause (where clause) in region.source.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:963",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "963",
      "builderLabel": "Order By Clause",
      "apexlangPath": "region.orderBy.orderByClause",
      "type": "ORDER BY CLAUSE",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "1238",
            "path": "region.orderBy.type",
            "hasToExist": true,
            "value": "STATIC"
          },
          {
            "type": "IN_LIST",
            "propertyId": "959",
            "path": "region.source.type",
            "hasToExist": false,
            "values": [
              "TABLE",
              "SQL",
              "FUNC_BODY_RETURNING_SQL",
              "$NULL$"
            ]
          }
        ]
      },
      "maxLength": 4000,
      "description": "Order By Clause (order by clause) in region.orderBy.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:964",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "964",
      "builderLabel": "SQL Query",
      "apexlangPath": "region.source.sqlQuery",
      "type": "SQL",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "959",
            "path": "region.source.type",
            "hasToExist": true,
            "value": "SQL"
          }
        ]
      },
      "maxLength": 32767,
      "description": "SQL Query (sql) in region.source.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:965",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "965",
      "builderLabel": "Caching",
      "apexlangPath": "region.remoteCache.caching",
      "type": "SELECT LIST",
      "required": false,
      "defaultValue": null,
      "values": [
        {
          "name": "allUsers",
          "returnValue": "ALL_USERS",
          "label": "For All Users"
        },
        {
          "name": "user",
          "returnValue": "USER",
          "label": "By User"
        },
        {
          "name": "session",
          "returnValue": "SESSION",
          "label": "By Session"
        }
      ],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "957",
            "path": "region.source.location",
            "hasToExist": true,
            "value": "REMOTE"
          }
        ]
      },
      "maxLength": null,
      "description": "Caching (select list) in region.remoteCache.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:966",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "966",
      "builderLabel": "Timeout",
      "apexlangPath": "region.remoteCache.timeout",
      "type": "TEXT EDITOR",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_NULL",
            "propertyId": "965",
            "path": "region.remoteCache.caching",
            "hasToExist": true
          }
        ]
      },
      "maxLength": 255,
      "description": "Timeout (text editor) in region.remoteCache.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:967",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "967",
      "builderLabel": "REST Source",
      "apexlangPath": "region.source.restSource",
      "type": "COMPONENT",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "957",
            "path": "region.source.location",
            "hasToExist": true,
            "value": "WEB_SOURCE"
          }
        ]
      },
      "maxLength": null,
      "description": "REST Source (component) in region.source.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:969",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "969",
      "builderLabel": "Nested Rows",
      "apexlangPath": "region.dataProfile.nestedRows",
      "type": "COMPONENT",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "FEATURES",
            "propertyId": "967",
            "path": "region.source.restSource",
            "hasToExist": true,
            "values": [
              "HAS_ARRAY_COLUMNS"
            ]
          }
        ]
      },
      "maxLength": null,
      "description": "Nested Rows (component) in region.dataProfile.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:975",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "975",
      "builderLabel": "Optimizer Hint",
      "apexlangPath": "region.source.optimizerHint",
      "type": "TEXT",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "IN_LIST",
            "propertyId": "957",
            "path": "region.source.location",
            "hasToExist": true,
            "values": [
              "LOCAL",
              "REMOTE",
              "WEB_SOURCE",
              "DUALITY_VIEW",
              "JSON_COLLECTION"
            ]
          }
        ]
      },
      "maxLength": 255,
      "description": "Optimizer Hint (text) in region.source.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:978",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "978",
      "builderLabel": "Include ROWID Column",
      "apexlangPath": "region.source.includeRowidColumn",
      "type": "YES NO",
      "required": true,
      "defaultValue": "N",
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "959",
            "path": "region.source.type",
            "hasToExist": true,
            "value": "TABLE"
          },
          {
            "type": "FEATURES",
            "propertyId": "958",
            "path": "region.source.remoteServer",
            "hasToExist": false,
            "values": [
              "IS_ORACLE"
            ]
          }
        ]
      },
      "maxLength": 32767,
      "description": "Include ROWID Column (yes no) in region.source.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:1034",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "1034",
      "builderLabel": "Type",
      "apexlangPath": "region.localPostProcessing.type",
      "type": "SELECT LIST",
      "required": false,
      "defaultValue": null,
      "values": [
        {
          "name": "whereOrderByClause",
          "returnValue": "WHERE_ORDER_BY_CLAUSE",
          "label": "Where/Order By Clause"
        },
        {
          "name": "sqlQuery",
          "returnValue": "SQL",
          "label": "SQL Query"
        },
        {
          "name": "plsqlFunctionBody",
          "returnValue": "FUNC_BODY_RETURNING_SQL",
          "label": "PL/SQL Function Body returning SQL Query"
        }
      ],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_NULL",
            "propertyId": "967",
            "path": "region.source.restSource",
            "hasToExist": true
          }
        ]
      },
      "maxLength": null,
      "description": "Type (select list) in region.localPostProcessing.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:1035",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "1035",
      "builderLabel": "Where Clause",
      "apexlangPath": "region.localPostProcessing.whereClause",
      "type": "WHERE CLAUSE",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "1034",
            "path": "region.localPostProcessing.type",
            "hasToExist": true,
            "value": "WHERE_ORDER_BY_CLAUSE"
          }
        ]
      },
      "maxLength": 4000,
      "description": "Where Clause (where clause) in region.localPostProcessing.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:1036",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "1036",
      "builderLabel": "Order By Clause",
      "apexlangPath": "region.localPostProcessing.orderByClause",
      "type": "ORDER BY CLAUSE",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "1241",
            "path": "region.localPostProcessing.orderByType",
            "hasToExist": true,
            "value": "STATIC"
          }
        ]
      },
      "maxLength": 255,
      "description": "Order By Clause (order by clause) in region.localPostProcessing.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:1041",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "1041",
      "builderLabel": "SQL Query",
      "apexlangPath": "region.localPostProcessing.sqlQuery",
      "type": "SQL",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "1034",
            "path": "region.localPostProcessing.type",
            "hasToExist": true,
            "value": "SQL"
          }
        ]
      },
      "maxLength": 32767,
      "description": "SQL Query (sql) in region.localPostProcessing.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:1042",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "1042",
      "builderLabel": "Enabled",
      "apexlangPath": "region.externalFilterAndOrderBy.enabled",
      "type": "YES NO",
      "required": true,
      "defaultValue": "N",
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_NULL",
            "propertyId": "967",
            "path": "region.source.restSource",
            "hasToExist": true
          },
          {
            "type": "IN_LIST",
            "propertyId": "1112",
            "path": "region.restSynchronization.useLocalTable",
            "hasToExist": false,
            "values": [
              "N",
              "$NULL$"
            ]
          }
        ]
      },
      "maxLength": 32767,
      "description": "Enabled (yes no) in region.externalFilterAndOrderBy.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:1043",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "1043",
      "builderLabel": "Filter",
      "apexlangPath": "region.externalFilterAndOrderBy.filter",
      "type": "TEXT EDITOR",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "1042",
            "path": "region.externalFilterAndOrderBy.enabled",
            "hasToExist": true,
            "value": "Y"
          }
        ]
      },
      "maxLength": 4000,
      "description": "Filter (text editor) in region.externalFilterAndOrderBy.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:1044",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "1044",
      "builderLabel": "Order By",
      "apexlangPath": "region.externalFilterAndOrderBy.orderBy",
      "type": "TEXT EDITOR",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "1244",
            "path": "region.externalFilterAndOrderBy.orderByType",
            "hasToExist": true,
            "value": "STATIC"
          }
        ]
      },
      "maxLength": 255,
      "description": "Order By (text editor) in region.externalFilterAndOrderBy.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:1112",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "1112",
      "builderLabel": "Use Local Table",
      "apexlangPath": "region.restSynchronization.useLocalTable",
      "type": "YES NO",
      "required": true,
      "defaultValue": "N",
      "values": [],
      "condition": {
        "operator": "OR",
        "conditions": [
          {
            "type": "FEATURES",
            "propertyId": "967",
            "path": "region.source.restSource",
            "hasToExist": true,
            "values": [
              "HAS_SYNC_HAS_NO_ARRAY_COLUMNS"
            ]
          },
          {
            "operator": "AND",
            "conditions": [
              {
                "type": "NULL",
                "propertyId": "969",
                "path": "region.dataProfile.nestedRows",
                "hasToExist": true
              },
              {
                "type": "FEATURES",
                "propertyId": "967",
                "path": "region.source.restSource",
                "hasToExist": true,
                "values": [
                  "HAS_SYNC_ALL_ARRAY_COLUMNS"
                ]
              }
            ]
          },
          {
            "type": "FEATURES",
            "propertyId": "969",
            "path": "region.dataProfile.nestedRows",
            "hasToExist": true,
            "values": [
              "IS_SYNCED"
            ]
          }
        ]
      },
      "maxLength": 32767,
      "description": "Use Local Table (yes no) in region.restSynchronization.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:1238",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "1238",
      "builderLabel": "Type",
      "apexlangPath": "region.orderBy.type",
      "type": "SELECT LIST",
      "required": false,
      "defaultValue": null,
      "values": [
        {
          "name": "staticValue",
          "returnValue": "STATIC",
          "label": "Static Value"
        },
        {
          "name": "item",
          "returnValue": "ITEM",
          "label": "Item"
        }
      ],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "FEATURES",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "ORDER_BY"
            ]
          },
          {
            "type": "IN_LIST",
            "propertyId": "957",
            "path": "region.source.location",
            "hasToExist": true,
            "values": [
              "LOCAL",
              "REMOTE",
              "SAMPLE_DATA"
            ]
          },
          {
            "type": "IN_LIST",
            "propertyId": "959",
            "path": "region.source.type",
            "hasToExist": false,
            "values": [
              "TABLE",
              "GRAPH",
              "SQL",
              "FUNC_BODY_RETURNING_SQL",
              "$NULL$"
            ]
          }
        ]
      },
      "maxLength": null,
      "description": "Type (select list) in region.orderBy.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:1239",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "1239",
      "builderLabel": "Item",
      "apexlangPath": "region.orderBy.item",
      "type": "ORDER BY ITEM",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "1238",
            "path": "region.orderBy.type",
            "hasToExist": true,
            "value": "ITEM"
          },
          {
            "type": "IN_LIST",
            "propertyId": "959",
            "path": "region.source.type",
            "hasToExist": false,
            "values": [
              "TABLE",
              "SQL",
              "FUNC_BODY_RETURNING_SQL",
              "$NULL$"
            ]
          }
        ]
      },
      "maxLength": 32767,
      "description": "Item (order by item) in region.orderBy.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:1241",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "1241",
      "builderLabel": "Order By Type",
      "apexlangPath": "region.localPostProcessing.orderByType",
      "type": "SELECT LIST",
      "required": false,
      "defaultValue": null,
      "values": [
        {
          "name": "staticValue",
          "returnValue": "STATIC",
          "label": "Static Value"
        },
        {
          "name": "item",
          "returnValue": "ITEM",
          "label": "Item"
        }
      ],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "1034",
            "path": "region.localPostProcessing.type",
            "hasToExist": true,
            "value": "WHERE_ORDER_BY_CLAUSE"
          }
        ]
      },
      "maxLength": null,
      "description": "Order By Type (select list) in region.localPostProcessing.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:1242",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "1242",
      "builderLabel": "Item",
      "apexlangPath": "region.localPostProcessing.item",
      "type": "ORDER BY ITEM",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "1241",
            "path": "region.localPostProcessing.orderByType",
            "hasToExist": true,
            "value": "ITEM"
          }
        ]
      },
      "maxLength": 32767,
      "description": "Item (order by item) in region.localPostProcessing.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:1243",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "1243",
      "builderLabel": "Order By Item",
      "apexlangPath": "region.localPostProcessing.orderByItem",
      "type": "ORDER BY ITEM",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "IN_LIST",
            "propertyId": "1034",
            "path": "region.localPostProcessing.type",
            "hasToExist": true,
            "values": [
              "SQL",
              "FUNC_BODY_RETURNING_SQL"
            ]
          }
        ]
      },
      "maxLength": 32767,
      "description": "Order By Item (order by item) in region.localPostProcessing.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:1244",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "1244",
      "builderLabel": "Order By Type",
      "apexlangPath": "region.externalFilterAndOrderBy.orderByType",
      "type": "SELECT LIST",
      "required": false,
      "defaultValue": null,
      "values": [
        {
          "name": "staticValue",
          "returnValue": "STATIC",
          "label": "Static Value"
        },
        {
          "name": "item",
          "returnValue": "ITEM",
          "label": "Item"
        }
      ],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "FEATURES",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "ORDER_BY"
            ]
          },
          {
            "type": "EQUALS",
            "propertyId": "1042",
            "path": "region.externalFilterAndOrderBy.enabled",
            "hasToExist": true,
            "value": "Y"
          }
        ]
      },
      "maxLength": null,
      "description": "Order By Type (select list) in region.externalFilterAndOrderBy.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:1245",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "1245",
      "builderLabel": "Item",
      "apexlangPath": "region.externalFilterAndOrderBy.item",
      "type": "ORDER BY ITEM",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "1244",
            "path": "region.externalFilterAndOrderBy.orderByType",
            "hasToExist": true,
            "value": "ITEM"
          }
        ]
      },
      "maxLength": 4000,
      "description": "Item (order by item) in region.externalFilterAndOrderBy.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:1603",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "1603",
      "builderLabel": "File URL",
      "apexlangPath": "region.image.fileUrl",
      "type": "TEXT",
      "required": {
        "operator": "AND",
        "conditions": [
          {
            "type": "FEATURES",
            "hasToExist": true,
            "values": [
              "REGION_IMAGE_URL"
            ],
            "propertyId": "217"
          }
        ]
      },
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "FEATURES",
            "propertyId": "217",
            "path": "region.appearance.template",
            "hasToExist": true,
            "values": [
              "REGION_IMAGE",
              "REGION_IMAGE_URL"
            ]
          }
        ]
      },
      "maxLength": 255,
      "description": "File URL (text) in region.image.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:1604",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "1604",
      "builderLabel": "Accessible Description",
      "apexlangPath": "region.image.accessibleDescription",
      "type": "TEXT",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "FEATURES",
            "propertyId": "217",
            "path": "region.appearance.template",
            "hasToExist": true,
            "values": [
              "REGION_IMAGE_ALT_TEXT"
            ]
          },
          {
            "type": "NOT_NULL",
            "propertyId": "1603",
            "path": "region.image.fileUrl",
            "hasToExist": true
          }
        ]
      },
      "maxLength": 255,
      "description": "Accessible Description (text) in region.image.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:1605",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "1605",
      "builderLabel": "Custom Attributes",
      "apexlangPath": "region.image.customAttributes",
      "type": "TEXT",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "FEATURES",
            "propertyId": "217",
            "path": "region.appearance.template",
            "hasToExist": true,
            "values": [
              "REGION_IMAGE_ATTRIBUTES"
            ]
          },
          {
            "type": "NOT_NULL",
            "propertyId": "1603",
            "path": "region.image.fileUrl",
            "hasToExist": true
          }
        ]
      },
      "maxLength": 255,
      "description": "Custom Attributes (text) in region.image.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:1669",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "1669",
      "builderLabel": "Use Landmark",
      "apexlangPath": "region.accessibility.useLandmark",
      "type": "YES NO",
      "required": true,
      "defaultValue": "Y",
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "FEATURES",
            "propertyId": "217",
            "path": "region.appearance.template",
            "hasToExist": true,
            "values": [
              "REGION_LANDMARK_ATTRIBUTES"
            ]
          }
        ]
      },
      "maxLength": 32767,
      "description": "Use Landmark (yes no) in region.accessibility.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:1670",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "1670",
      "builderLabel": "Landmark Type",
      "apexlangPath": "region.accessibility.landmarkType",
      "type": "SELECT LIST",
      "required": false,
      "defaultValue": null,
      "values": [
        {
          "name": "banner",
          "returnValue": "banner",
          "label": "Banner"
        },
        {
          "name": "complementary",
          "returnValue": "complementary",
          "label": "Complementary"
        },
        {
          "name": "contentInfo",
          "returnValue": "contentinfo",
          "label": "Content Info"
        },
        {
          "name": "form",
          "returnValue": "form",
          "label": "Form"
        },
        {
          "name": "main",
          "returnValue": "main",
          "label": "Main"
        },
        {
          "name": "navigation",
          "returnValue": "navigation",
          "label": "Navigation"
        },
        {
          "name": "region",
          "returnValue": "region",
          "label": "Region"
        },
        {
          "name": "search",
          "returnValue": "search",
          "label": "Search"
        }
      ],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "1669",
            "path": "region.accessibility.useLandmark",
            "hasToExist": true,
            "value": "Y"
          }
        ]
      },
      "maxLength": null,
      "description": "Landmark Type (select list) in region.accessibility.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:1671",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "1671",
      "builderLabel": "Landmark Label",
      "apexlangPath": "region.accessibility.landmarkLabel",
      "type": "TEXT",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "1669",
            "path": "region.accessibility.useLandmark",
            "hasToExist": true,
            "value": "Y"
          }
        ]
      },
      "maxLength": 255,
      "description": "Landmark Label (text) in region.accessibility.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5000",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5000",
      "builderLabel": "Type",
      "apexlangPath": "region.serverCache.type",
      "type": "SELECT LIST",
      "required": false,
      "defaultValue": null,
      "values": [
        {
          "name": "always",
          "returnValue": "ALWAYS",
          "label": "Always"
        },
        {
          "name": "rowsReturned",
          "returnValue": "EXISTS",
          "label": "Rows returned"
        },
        {
          "name": "noRowsReturned",
          "returnValue": "NOT_EXISTS",
          "label": "No Rows returned"
        },
        {
          "name": "expression",
          "returnValue": "EXPRESSION",
          "label": "Expression"
        },
        {
          "name": "functionBody",
          "returnValue": "FUNCTION_BODY",
          "label": "Function Body"
        },
        {
          "name": "request=Value",
          "returnValue": "REQUEST_EQUALS_CONDITION",
          "label": "Request = Value"
        },
        {
          "name": "request!=Value",
          "returnValue": "REQUEST_NOT_EQUAL_CONDITION",
          "label": "Request != Value"
        },
        {
          "name": "requestIsContainedInValue",
          "returnValue": "REQUEST_IN_CONDITION",
          "label": "Request is contained in Value"
        },
        {
          "name": "requestIsNotContainedInValue",
          "returnValue": "REQUEST_NOT_IN_CONDITION",
          "label": "Request is NOT contained in Value"
        },
        {
          "name": "item=value",
          "returnValue": "VAL_OF_ITEM_IN_COND_EQ_COND2",
          "label": "Item = Value"
        },
        {
          "name": "item!=value",
          "returnValue": "VAL_OF_ITEM_IN_COND_NOT_EQ_COND2",
          "label": "Item != Value"
        },
        {
          "name": "itemIsNull",
          "returnValue": "ITEM_IS_NULL",
          "label": "Item is NULL"
        },
        {
          "name": "itemIsNotNull",
          "returnValue": "ITEM_IS_NOT_NULL",
          "label": "Item is NOT NULL"
        },
        {
          "name": "itemIsZero",
          "returnValue": "ITEM_IS_ZERO",
          "label": "Item is zero"
        },
        {
          "name": "itemIsNotZero",
          "returnValue": "ITEM_IS_NOT_ZERO",
          "label": "Item is NOT zero"
        },
        {
          "name": "itemIsNullOrZero",
          "returnValue": "ITEM_IS_NULL_OR_ZERO",
          "label": "Item is NULL or zero"
        },
        {
          "name": "itemIsNotNullAndNotZero",
          "returnValue": "ITEM_NOT_NULL_OR_ZERO",
          "label": "Item is NOT NULL and NOT zero"
        },
        {
          "name": "itemContainsNoSpaces",
          "returnValue": "ITEM_CONTAINS_NO_SPACES",
          "label": "Item contains no spaces"
        },
        {
          "name": "itemIsNumeric",
          "returnValue": "ITEM_IS_NUMERIC",
          "label": "Item is numeric"
        },
        {
          "name": "itemIsNotNumeric",
          "returnValue": "ITEM_IS_NOT_NUMERIC",
          "label": "Item is NOT numeric"
        },
        {
          "name": "itemIsAlphanumeric",
          "returnValue": "ITEM_IS_ALPHANUMERIC",
          "label": "Item is alphanumeric"
        },
        {
          "name": "itemIsInColonDelimitedList",
          "returnValue": "VALUE_OF_ITEM_IN_CONDITION_IN_COLON_DELIMITED_LIST",
          "label": "Item is in colon delimited list"
        },
        {
          "name": "itemIsNotInColonDelimitedList",
          "returnValue": "VALUE_OF_ITEM_IN_CONDITION_NOT_IN_COLON_DELIMITED_LIST",
          "label": "Item is NOT in colon delimited list"
        },
        {
          "name": "textIsContainedInItem",
          "returnValue": "CONDITION1_IN_VALUE_OF_ITEM_IN_CONDITION2",
          "label": "Text is contained in Item"
        },
        {
          "name": "text=value",
          "returnValue": "DISPLAY_COND_EQUAL_COND_TEXT",
          "label": "Text = Value"
        },
        {
          "name": "text!=value",
          "returnValue": "DISP_COND_NOT_EQUAL_COND_TEXT",
          "label": "Text != Value"
        },
        {
          "name": "textIsContainedInValue",
          "returnValue": "DISPLAY_COND_IN_COND_TEXT",
          "label": "Text is contained in Value"
        },
        {
          "name": "textIsNotContainedInValue",
          "returnValue": "DISPLAY_COND_NOT_IN_COND_TEXT",
          "label": "Text is NOT contained in Value"
        },
        {
          "name": "userPreference=value",
          "returnValue": "USER_PREF_IN_COND_EQ_COND2",
          "label": "User Preference = Value"
        },
        {
          "name": "userPreference!=value",
          "returnValue": "USER_PREF_IN_COND_NOT_EQ_COND2",
          "label": "User Preference != Value"
        },
        {
          "name": "currentPage=page",
          "returnValue": "CURRENT_PAGE_EQUALS_CONDITION",
          "label": "Current Page = Page"
        },
        {
          "name": "currentPage!=page",
          "returnValue": "CURRENT_PAGE_NOT_EQUAL_CONDITION",
          "label": "Current Page != Page"
        },
        {
          "name": "currentPageInList",
          "returnValue": "CURRENT_PAGE_IN_CONDITION",
          "label": "Current Page is in comma delimited list"
        },
        {
          "name": "currentPageNotInList",
          "returnValue": "CURRENT_PAGE_NOT_IN_CONDITION",
          "label": "Current Page is NOT in comma delimited list"
        },
        {
          "name": "currentPage=pageSubmitted",
          "returnValue": "WHEN_THIS_PAGE_SUBMITTED",
          "label": "Current Page = Page Submitted (posted)"
        },
        {
          "name": "currentPage!=pageSubmitted",
          "returnValue": "WHEN_THIS_PAGE_NOT_SUBMITTED",
          "label": "Current Page != Page Submitted (posted)"
        },
        {
          "name": "currentPageIsInPrinterFriendlyMode",
          "returnValue": "PAGE_IS_IN_PRINTER_FRIENDLY_MODE",
          "label": "Current Page is in Printer Friendly Mode"
        },
        {
          "name": "currentPageIsNotInPrinterFriendlyMode",
          "returnValue": "PAGE_IS_NOT_IN_PRINTER_FRIENDLY_MODE",
          "label": "Current page is NOT in Printer Friendly Mode"
        },
        {
          "name": "pageRegionIsReadOnly",
          "returnValue": "IS_READ_ONLY",
          "label": "Page/Region is Read Only"
        },
        {
          "name": "pageRegionIsNotReadOnly",
          "returnValue": "IS_NOT_READ_ONLY",
          "label": "Page/Region is NOT Read Only"
        },
        {
          "name": "userIsAuthenticated",
          "returnValue": "USER_IS_NOT_PUBLIC_USER",
          "label": "User is Authenticated (not public)"
        },
        {
          "name": "userIsPublicUser",
          "returnValue": "USER_IS_PUBLIC_USER",
          "label": "User is the Public User (user has not authenticated)"
        },
        {
          "name": "inlineValidationErrorsDisplayed",
          "returnValue": "DISPLAYING_INLINE_VALIDATION_ERRORS",
          "label": "Inline Validation Errors displayed"
        },
        {
          "name": "inlineValidationErrorsNotDisplayed",
          "returnValue": "NOT_DISPLAYING_INLINE_VALIDATION_ERRORS",
          "label": "Inline Validation Errors NOT displayed"
        },
        {
          "name": "sqlReportsOkToShowForwardButton",
          "returnValue": "MAX_ROWS_LT_ROWS_FETCHED",
          "label": "SQL Reports (OK to show the forward button)"
        },
        {
          "name": "sqlReportsOkToShowBackButton",
          "returnValue": "MIN_ROW_GT_THAN_ONE",
          "label": "SQL Reports (OK to show the back button)"
        },
        {
          "name": "currentLanguage=value",
          "returnValue": "CURRENT_LANG_EQ_COND1",
          "label": "Current Language = Value"
        },
        {
          "name": "currentLanguage!=value",
          "returnValue": "CURRENT_LANG_NOT_EQ_COND1",
          "label": "Current Language != Value"
        },
        {
          "name": "currentLanguageIsContainedInValue",
          "returnValue": "CURRENT_LANG_IN_COND1",
          "label": "Current Language is contained in Value"
        },
        {
          "name": "currentLanguageIsNotContainedInValue",
          "returnValue": "CURRENT_LANG_NOT_IN_COND1",
          "label": "Current Language is NOT contained in Value"
        },
        {
          "name": "clientBrowserIsMozilla",
          "returnValue": "BROWSER_IS_NSCP",
          "label": "Client Browser is Mozilla, Netscape 6.x/7x or higher"
        },
        {
          "name": "clientBrowserIsIE7higher",
          "returnValue": "BROWSER_IS_MSIE",
          "label": "Client Browser is Microsoft Internet Explorer 7.0 or higher"
        },
        {
          "name": "clientBrowserIsXhtmlCssCapable",
          "returnValue": "BROWSER_IS_MSIE_OR_NSCP",
          "label": "Client Browser is XHTML / CSS capable browser"
        },
        {
          "name": "clientBrowserIsOther",
          "returnValue": "BROWSER_IS_OTHER",
          "label": "Client Browser is Other browsers (or older version)"
        },
        {
          "name": "cgiEnvDadName=value",
          "returnValue": "DAD_NAME_EQ_CONDITION",
          "label": "CGI_ENV: DAD_NAME = Value"
        },
        {
          "name": "cgiEnvDadName!=value",
          "returnValue": "DAD_NAME_NOT_EQ_CONDITION",
          "label": "CGI_ENV: DAD_NAME != Value"
        },
        {
          "name": "cgiEnvServerName=value",
          "returnValue": "SERVER_NAME_EQ_CONDITION",
          "label": "CGI_ENV: SERVER_NAME = Value"
        },
        {
          "name": "cgiEnvServerName!=value",
          "returnValue": "SERVER_NAME_NOT_EQ_CONDITION",
          "label": "CGI_ENV: SERVER_NAME != Value"
        },
        {
          "name": "cgiEnvHttpHost=value",
          "returnValue": "HTTP_HOST_EQ_CONDITION",
          "label": "CGI_ENV: HTTP_HOST = Value"
        },
        {
          "name": "cgiEnvHttpHost!=value",
          "returnValue": "HTTP_HOST_NOT_EQ_CONDITION",
          "label": "CGI_ENV: HTTP_HOST != Value"
        },
        {
          "name": "never",
          "returnValue": "NEVER",
          "label": "Never"
        }
      ],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_EQUALS",
            "propertyId": "222",
            "path": "region.serverCache.caching",
            "hasToExist": true,
            "value": "NOCACHE"
          }
        ]
      },
      "maxLength": null,
      "description": "Type (select list) in region.serverCache.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5001",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5001",
      "builderLabel": "SQL Query",
      "apexlangPath": "region.serverCache.sqlQuery",
      "type": "SQL",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "IN_LIST",
            "propertyId": "5000",
            "path": "region.serverCache.type",
            "hasToExist": true,
            "values": [
              "EXISTS",
              "NOT_EXISTS"
            ]
          }
        ]
      },
      "maxLength": 4000,
      "description": "SQL Query (sql) in region.serverCache.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5002",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5002",
      "builderLabel": "Value",
      "apexlangPath": "region.serverCache.value",
      "type": "TEXT",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "IN_LIST",
            "propertyId": "5000",
            "path": "region.serverCache.type",
            "hasToExist": true,
            "values": [
              "REQUEST_EQUALS_CONDITION",
              "REQUEST_NOT_EQUAL_CONDITION",
              "REQUEST_IN_CONDITION",
              "REQUEST_NOT_IN_CONDITION",
              "CURRENT_LANG_IN_COND1",
              "CURRENT_LANG_NOT_IN_COND1",
              "CURRENT_LANG_NOT_EQ_COND1",
              "CURRENT_LANG_EQ_COND1",
              "DAD_NAME_EQ_CONDITION",
              "DAD_NAME_NOT_EQ_CONDITION",
              "SERVER_NAME_EQ_CONDITION",
              "SERVER_NAME_NOT_EQ_CONDITION",
              "HTTP_HOST_EQ_CONDITION",
              "HTTP_HOST_NOT_EQ_CONDITION"
            ]
          }
        ]
      },
      "maxLength": 4000,
      "description": "Value (text) in region.serverCache.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5003",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5003",
      "builderLabel": "Item",
      "apexlangPath": "region.serverCache.item",
      "type": "ITEM",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "IN_LIST",
            "propertyId": "5000",
            "path": "region.serverCache.type",
            "hasToExist": true,
            "values": [
              "VAL_OF_ITEM_IN_COND_EQ_COND2",
              "VAL_OF_ITEM_IN_COND_NOT_EQ_COND2",
              "VALUE_OF_ITEM_IN_COND_1_EQ_COND_2",
              "VALUE_OF_ITEM_IN_COND_1_NOT_EQ_COND_2",
              "ITEM_IS_NULL",
              "ITEM_IS_NOT_NULL",
              "ITEM_IS_ZERO",
              "ITEM_IS_NOT_ZERO",
              "ITEM_IS_NULL_OR_ZERO",
              "ITEM_NOT_NULL_OR_ZERO",
              "ITEM_CONTAINS_NO_SPACES",
              "ITEM_IS_NUMERIC",
              "ITEM_IS_NOT_NUMERIC",
              "ITEM_IS_ALPHANUMERIC",
              "VALUE_OF_ITEM_IN_CONDITION_IN_COLON_DELIMITED_LIST",
              "VALUE_OF_ITEM_IN_CONDITION_NOT_IN_COLON_DELIMITED_LIST"
            ]
          }
        ]
      },
      "maxLength": 4000,
      "description": "Item (item) in region.serverCache.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5004",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5004",
      "builderLabel": "List",
      "apexlangPath": "region.serverCache.list",
      "type": "TEXT",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "IN_LIST",
            "propertyId": "5000",
            "path": "region.serverCache.type",
            "hasToExist": true,
            "values": [
              "VALUE_OF_ITEM_IN_CONDITION_IN_COLON_DELIMITED_LIST",
              "VALUE_OF_ITEM_IN_CONDITION_NOT_IN_COLON_DELIMITED_LIST"
            ]
          }
        ]
      },
      "maxLength": 4000,
      "description": "List (text) in region.serverCache.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5005",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5005",
      "builderLabel": "Preference",
      "apexlangPath": "region.serverCache.preference",
      "type": "TEXT",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "IN_LIST",
            "propertyId": "5000",
            "path": "region.serverCache.type",
            "hasToExist": true,
            "values": [
              "USER_PREF_IN_COND_EQ_COND2",
              "USER_PREF_IN_COND_NOT_EQ_COND2"
            ]
          }
        ]
      },
      "maxLength": 4000,
      "description": "Preference (text) in region.serverCache.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5006",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5006",
      "builderLabel": "Page",
      "apexlangPath": "region.serverCache.page",
      "type": "PAGE",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "IN_LIST",
            "propertyId": "5000",
            "path": "region.serverCache.type",
            "hasToExist": true,
            "values": [
              "CURRENT_PAGE_EQUALS_CONDITION",
              "CURRENT_PAGE_NOT_EQUAL_CONDITION"
            ]
          }
        ]
      },
      "maxLength": 4000,
      "description": "Page (page) in region.serverCache.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5007",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5007",
      "builderLabel": "Pages",
      "apexlangPath": "region.serverCache.pages",
      "type": "PAGE",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "IN_LIST",
            "propertyId": "5000",
            "path": "region.serverCache.type",
            "hasToExist": true,
            "values": [
              "CURRENT_PAGE_IN_CONDITION",
              "CURRENT_PAGE_NOT_IN_CONDITION"
            ]
          }
        ]
      },
      "maxLength": 4000,
      "description": "Pages (page) in region.serverCache.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5008",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5008",
      "builderLabel": "Text",
      "apexlangPath": "region.serverCache.text",
      "type": "TEXT",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "IN_LIST",
            "propertyId": "5000",
            "path": "region.serverCache.type",
            "hasToExist": true,
            "values": [
              "CONDITION1_IN_VALUE_OF_ITEM_IN_CONDITION2",
              "DISPLAY_COND_IN_COND_TEXT",
              "DISPLAY_COND_NOT_IN_COND_TEXT",
              "DISPLAY_COND_EQUAL_COND_TEXT",
              "DISP_COND_NOT_EQUAL_COND_TEXT"
            ]
          }
        ]
      },
      "maxLength": 4000,
      "description": "Text (text) in region.serverCache.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5009",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5009",
      "builderLabel": "Value",
      "apexlangPath": "region.serverCache.value",
      "type": "TEXT",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "IN_LIST",
            "propertyId": "5000",
            "path": "region.serverCache.type",
            "hasToExist": true,
            "values": [
              "VAL_OF_ITEM_IN_COND_EQ_COND2",
              "VAL_OF_ITEM_IN_COND_NOT_EQ_COND2",
              "VALUE_OF_ITEM_IN_COND_1_EQ_COND_2",
              "VALUE_OF_ITEM_IN_COND_1_NOT_EQ_COND_2",
              "USER_PREF_IN_COND_EQ_COND2",
              "USER_PREF_IN_COND_NOT_EQ_COND2"
            ]
          }
        ]
      },
      "maxLength": 4000,
      "description": "Value (text) in region.serverCache.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5010",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5010",
      "builderLabel": "Item",
      "apexlangPath": "region.serverCache.item",
      "type": "ITEM",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "5000",
            "path": "region.serverCache.type",
            "hasToExist": true,
            "value": "CONDITION1_IN_VALUE_OF_ITEM_IN_CONDITION2"
          }
        ]
      },
      "maxLength": 4000,
      "description": "Item (item) in region.serverCache.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5011",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5011",
      "builderLabel": "Value",
      "apexlangPath": "region.serverCache.value",
      "type": "TEXT",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "IN_LIST",
            "propertyId": "5000",
            "path": "region.serverCache.type",
            "hasToExist": true,
            "values": [
              "DISPLAY_COND_IN_COND_TEXT",
              "DISPLAY_COND_NOT_IN_COND_TEXT",
              "DISPLAY_COND_EQUAL_COND_TEXT",
              "DISP_COND_NOT_EQUAL_COND_TEXT"
            ]
          }
        ]
      },
      "maxLength": 4000,
      "description": "Value (text) in region.serverCache.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5012",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5012",
      "builderLabel": "Language",
      "apexlangPath": "region.serverCache.language",
      "type": "CODE LANGUAGE",
      "required": true,
      "defaultValue": "PLSQL",
      "values": [
        {
          "name": "sql",
          "returnValue": "SQL",
          "label": "SQL"
        },
        {
          "name": "plsql",
          "returnValue": "PLSQL",
          "label": "PL/SQL"
        },
        {
          "name": "javaScript-mle",
          "returnValue": "JAVASCRIPT",
          "label": "JavaScript (MLE)"
        }
      ],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "5000",
            "path": "region.serverCache.type",
            "hasToExist": true,
            "value": "EXPRESSION"
          }
        ]
      },
      "maxLength": null,
      "description": "Language (code language) in region.serverCache.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5013",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5013",
      "builderLabel": "SQL Expression",
      "apexlangPath": "region.serverCache.sqlExpression",
      "type": "SQL EXPRESSION BOOLEAN",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "5012",
            "path": "region.serverCache.language",
            "hasToExist": true,
            "value": "SQL"
          }
        ]
      },
      "maxLength": 4000,
      "description": "SQL Expression (sql expression boolean) in region.serverCache.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5014",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5014",
      "builderLabel": "PL/SQL Expression",
      "apexlangPath": "region.serverCache.plsqlExpression",
      "type": "PLSQL EXPRESSION BOOLEAN",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "5012",
            "path": "region.serverCache.language",
            "hasToExist": true,
            "value": "PLSQL"
          }
        ]
      },
      "maxLength": 4000,
      "description": "PL/SQL Expression (plsql expression boolean) in region.serverCache.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5015",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5015",
      "builderLabel": "JavaScript Expression",
      "apexlangPath": "region.serverCache.javaScriptExpression",
      "type": "MLE JAVASCRIPT EXPRESSION BOOLEAN",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "5012",
            "path": "region.serverCache.language",
            "hasToExist": true,
            "value": "JAVASCRIPT"
          }
        ]
      },
      "maxLength": 4000,
      "description": "JavaScript Expression (mle javascript expression boolean) in region.serverCache.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5032",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5032",
      "builderLabel": "Language",
      "apexlangPath": "region.serverCache.language",
      "type": "CODE LANGUAGE",
      "required": true,
      "defaultValue": "PLSQL",
      "values": [
        {
          "name": "plsql",
          "returnValue": "PLSQL",
          "label": "PL/SQL"
        },
        {
          "name": "javaScript-mle",
          "returnValue": "JAVASCRIPT",
          "label": "JavaScript (MLE)"
        }
      ],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "5000",
            "path": "region.serverCache.type",
            "hasToExist": true,
            "value": "FUNCTION_BODY"
          }
        ]
      },
      "maxLength": null,
      "description": "Language (code language) in region.serverCache.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5033",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5033",
      "builderLabel": "PL/SQL Function Body",
      "apexlangPath": "region.serverCache.plsqlFunctionBody",
      "type": "PLSQL FUNCTION BODY BOOLEAN",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "5032",
            "path": "region.serverCache.language",
            "hasToExist": true,
            "value": "PLSQL"
          }
        ]
      },
      "maxLength": 4000,
      "description": "PL/SQL Function Body (plsql function body boolean) in region.serverCache.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5034",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5034",
      "builderLabel": "JavaScript Function Body",
      "apexlangPath": "region.serverCache.javaScriptFunctionBody",
      "type": "MLE JAVASCRIPT FUNCTION BODY BOOLEAN",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "5032",
            "path": "region.serverCache.language",
            "hasToExist": true,
            "value": "JAVASCRIPT"
          }
        ]
      },
      "maxLength": 4000,
      "description": "JavaScript Function Body (mle javascript function body boolean) in region.serverCache.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5050",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5050",
      "builderLabel": "Type",
      "apexlangPath": "region.readOnly.type",
      "type": "SELECT LIST",
      "required": false,
      "defaultValue": null,
      "values": [
        {
          "name": "always",
          "returnValue": "ALWAYS",
          "label": "Always"
        },
        {
          "name": "rowsReturned",
          "returnValue": "EXISTS",
          "label": "Rows returned"
        },
        {
          "name": "noRowsReturned",
          "returnValue": "NOT_EXISTS",
          "label": "No Rows returned"
        },
        {
          "name": "expression",
          "returnValue": "EXPRESSION",
          "label": "Expression"
        },
        {
          "name": "functionBody",
          "returnValue": "FUNCTION_BODY",
          "label": "Function Body"
        },
        {
          "name": "request=Value",
          "returnValue": "REQUEST_EQUALS_CONDITION",
          "label": "Request = Value"
        },
        {
          "name": "request!=Value",
          "returnValue": "REQUEST_NOT_EQUAL_CONDITION",
          "label": "Request != Value"
        },
        {
          "name": "requestIsContainedInValue",
          "returnValue": "REQUEST_IN_CONDITION",
          "label": "Request is contained in Value"
        },
        {
          "name": "requestIsNotContainedInValue",
          "returnValue": "REQUEST_NOT_IN_CONDITION",
          "label": "Request is NOT contained in Value"
        },
        {
          "name": "item=value",
          "returnValue": "VAL_OF_ITEM_IN_COND_EQ_COND2",
          "label": "Item = Value"
        },
        {
          "name": "item!=value",
          "returnValue": "VAL_OF_ITEM_IN_COND_NOT_EQ_COND2",
          "label": "Item != Value"
        },
        {
          "name": "itemIsNull",
          "returnValue": "ITEM_IS_NULL",
          "label": "Item is NULL"
        },
        {
          "name": "itemIsNotNull",
          "returnValue": "ITEM_IS_NOT_NULL",
          "label": "Item is NOT NULL"
        },
        {
          "name": "itemIsZero",
          "returnValue": "ITEM_IS_ZERO",
          "label": "Item is zero"
        },
        {
          "name": "itemIsNotZero",
          "returnValue": "ITEM_IS_NOT_ZERO",
          "label": "Item is NOT zero"
        },
        {
          "name": "itemIsNullOrZero",
          "returnValue": "ITEM_IS_NULL_OR_ZERO",
          "label": "Item is NULL or zero"
        },
        {
          "name": "itemIsNotNullAndNotZero",
          "returnValue": "ITEM_NOT_NULL_OR_ZERO",
          "label": "Item is NOT NULL and NOT zero"
        },
        {
          "name": "itemContainsNoSpaces",
          "returnValue": "ITEM_CONTAINS_NO_SPACES",
          "label": "Item contains no spaces"
        },
        {
          "name": "itemIsNumeric",
          "returnValue": "ITEM_IS_NUMERIC",
          "label": "Item is numeric"
        },
        {
          "name": "itemIsNotNumeric",
          "returnValue": "ITEM_IS_NOT_NUMERIC",
          "label": "Item is NOT numeric"
        },
        {
          "name": "itemIsAlphanumeric",
          "returnValue": "ITEM_IS_ALPHANUMERIC",
          "label": "Item is alphanumeric"
        },
        {
          "name": "itemIsInColonDelimitedList",
          "returnValue": "VALUE_OF_ITEM_IN_CONDITION_IN_COLON_DELIMITED_LIST",
          "label": "Item is in colon delimited list"
        },
        {
          "name": "itemIsNotInColonDelimitedList",
          "returnValue": "VALUE_OF_ITEM_IN_CONDITION_NOT_IN_COLON_DELIMITED_LIST",
          "label": "Item is NOT in colon delimited list"
        },
        {
          "name": "textIsContainedInItem",
          "returnValue": "CONDITION1_IN_VALUE_OF_ITEM_IN_CONDITION2",
          "label": "Text is contained in Item"
        },
        {
          "name": "text=value",
          "returnValue": "DISPLAY_COND_EQUAL_COND_TEXT",
          "label": "Text = Value"
        },
        {
          "name": "text!=value",
          "returnValue": "DISP_COND_NOT_EQUAL_COND_TEXT",
          "label": "Text != Value"
        },
        {
          "name": "textIsContainedInValue",
          "returnValue": "DISPLAY_COND_IN_COND_TEXT",
          "label": "Text is contained in Value"
        },
        {
          "name": "textIsNotContainedInValue",
          "returnValue": "DISPLAY_COND_NOT_IN_COND_TEXT",
          "label": "Text is NOT contained in Value"
        },
        {
          "name": "userPreference=value",
          "returnValue": "USER_PREF_IN_COND_EQ_COND2",
          "label": "User Preference = Value"
        },
        {
          "name": "userPreference!=value",
          "returnValue": "USER_PREF_IN_COND_NOT_EQ_COND2",
          "label": "User Preference != Value"
        },
        {
          "name": "currentPage=page",
          "returnValue": "CURRENT_PAGE_EQUALS_CONDITION",
          "label": "Current Page = Page"
        },
        {
          "name": "currentPage!=page",
          "returnValue": "CURRENT_PAGE_NOT_EQUAL_CONDITION",
          "label": "Current Page != Page"
        },
        {
          "name": "currentPageInList",
          "returnValue": "CURRENT_PAGE_IN_CONDITION",
          "label": "Current Page is in comma delimited list"
        },
        {
          "name": "currentPageNotInList",
          "returnValue": "CURRENT_PAGE_NOT_IN_CONDITION",
          "label": "Current Page is NOT in comma delimited list"
        },
        {
          "name": "currentPage=pageSubmitted",
          "returnValue": "WHEN_THIS_PAGE_SUBMITTED",
          "label": "Current Page = Page Submitted (posted)"
        },
        {
          "name": "currentPage!=pageSubmitted",
          "returnValue": "WHEN_THIS_PAGE_NOT_SUBMITTED",
          "label": "Current Page != Page Submitted (posted)"
        },
        {
          "name": "currentPageIsInPrinterFriendlyMode",
          "returnValue": "PAGE_IS_IN_PRINTER_FRIENDLY_MODE",
          "label": "Current Page is in Printer Friendly Mode"
        },
        {
          "name": "currentPageIsNotInPrinterFriendlyMode",
          "returnValue": "PAGE_IS_NOT_IN_PRINTER_FRIENDLY_MODE",
          "label": "Current page is NOT in Printer Friendly Mode"
        },
        {
          "name": "pageRegionIsReadOnly",
          "returnValue": "IS_READ_ONLY",
          "label": "Page/Region is Read Only"
        },
        {
          "name": "pageRegionIsNotReadOnly",
          "returnValue": "IS_NOT_READ_ONLY",
          "label": "Page/Region is NOT Read Only"
        },
        {
          "name": "userIsAuthenticated",
          "returnValue": "USER_IS_NOT_PUBLIC_USER",
          "label": "User is Authenticated (not public)"
        },
        {
          "name": "userIsPublicUser",
          "returnValue": "USER_IS_PUBLIC_USER",
          "label": "User is the Public User (user has not authenticated)"
        },
        {
          "name": "inlineValidationErrorsDisplayed",
          "returnValue": "DISPLAYING_INLINE_VALIDATION_ERRORS",
          "label": "Inline Validation Errors displayed"
        },
        {
          "name": "inlineValidationErrorsNotDisplayed",
          "returnValue": "NOT_DISPLAYING_INLINE_VALIDATION_ERRORS",
          "label": "Inline Validation Errors NOT displayed"
        },
        {
          "name": "sqlReportsOkToShowForwardButton",
          "returnValue": "MAX_ROWS_LT_ROWS_FETCHED",
          "label": "SQL Reports (OK to show the forward button)"
        },
        {
          "name": "sqlReportsOkToShowBackButton",
          "returnValue": "MIN_ROW_GT_THAN_ONE",
          "label": "SQL Reports (OK to show the back button)"
        },
        {
          "name": "currentLanguage=value",
          "returnValue": "CURRENT_LANG_EQ_COND1",
          "label": "Current Language = Value"
        },
        {
          "name": "currentLanguage!=value",
          "returnValue": "CURRENT_LANG_NOT_EQ_COND1",
          "label": "Current Language != Value"
        },
        {
          "name": "currentLanguageIsContainedInValue",
          "returnValue": "CURRENT_LANG_IN_COND1",
          "label": "Current Language is contained in Value"
        },
        {
          "name": "currentLanguageIsNotContainedInValue",
          "returnValue": "CURRENT_LANG_NOT_IN_COND1",
          "label": "Current Language is NOT contained in Value"
        },
        {
          "name": "clientBrowserIsMozilla",
          "returnValue": "BROWSER_IS_NSCP",
          "label": "Client Browser is Mozilla, Netscape 6.x/7x or higher"
        },
        {
          "name": "clientBrowserIsIE7higher",
          "returnValue": "BROWSER_IS_MSIE",
          "label": "Client Browser is Microsoft Internet Explorer 7.0 or higher"
        },
        {
          "name": "clientBrowserIsXhtmlCssCapable",
          "returnValue": "BROWSER_IS_MSIE_OR_NSCP",
          "label": "Client Browser is XHTML / CSS capable browser"
        },
        {
          "name": "clientBrowserIsOther",
          "returnValue": "BROWSER_IS_OTHER",
          "label": "Client Browser is Other browsers (or older version)"
        },
        {
          "name": "cgiEnvDadName=value",
          "returnValue": "DAD_NAME_EQ_CONDITION",
          "label": "CGI_ENV: DAD_NAME = Value"
        },
        {
          "name": "cgiEnvDadName!=value",
          "returnValue": "DAD_NAME_NOT_EQ_CONDITION",
          "label": "CGI_ENV: DAD_NAME != Value"
        },
        {
          "name": "cgiEnvServerName=value",
          "returnValue": "SERVER_NAME_EQ_CONDITION",
          "label": "CGI_ENV: SERVER_NAME = Value"
        },
        {
          "name": "cgiEnvServerName!=value",
          "returnValue": "SERVER_NAME_NOT_EQ_CONDITION",
          "label": "CGI_ENV: SERVER_NAME != Value"
        },
        {
          "name": "cgiEnvHttpHost=value",
          "returnValue": "HTTP_HOST_EQ_CONDITION",
          "label": "CGI_ENV: HTTP_HOST = Value"
        },
        {
          "name": "cgiEnvHttpHost!=value",
          "returnValue": "HTTP_HOST_NOT_EQ_CONDITION",
          "label": "CGI_ENV: HTTP_HOST != Value"
        },
        {
          "name": "never",
          "returnValue": "NEVER",
          "label": "Never"
        }
      ],
      "condition": null,
      "maxLength": null,
      "description": "Type (select list) in region.readOnly.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5051",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5051",
      "builderLabel": "SQL Query",
      "apexlangPath": "region.readOnly.sqlQuery",
      "type": "SQL",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "IN_LIST",
            "propertyId": "5050",
            "path": "region.readOnly.type",
            "hasToExist": true,
            "values": [
              "EXISTS",
              "NOT_EXISTS"
            ]
          }
        ]
      },
      "maxLength": 4000,
      "description": "SQL Query (sql) in region.readOnly.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5052",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5052",
      "builderLabel": "Value",
      "apexlangPath": "region.readOnly.value",
      "type": "TEXT",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "IN_LIST",
            "propertyId": "5050",
            "path": "region.readOnly.type",
            "hasToExist": true,
            "values": [
              "REQUEST_EQUALS_CONDITION",
              "REQUEST_NOT_EQUAL_CONDITION",
              "REQUEST_IN_CONDITION",
              "REQUEST_NOT_IN_CONDITION",
              "CURRENT_LANG_IN_COND1",
              "CURRENT_LANG_NOT_IN_COND1",
              "CURRENT_LANG_NOT_EQ_COND1",
              "CURRENT_LANG_EQ_COND1",
              "DAD_NAME_EQ_CONDITION",
              "DAD_NAME_NOT_EQ_CONDITION",
              "SERVER_NAME_EQ_CONDITION",
              "SERVER_NAME_NOT_EQ_CONDITION",
              "HTTP_HOST_EQ_CONDITION",
              "HTTP_HOST_NOT_EQ_CONDITION"
            ]
          }
        ]
      },
      "maxLength": 4000,
      "description": "Value (text) in region.readOnly.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5053",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5053",
      "builderLabel": "Item",
      "apexlangPath": "region.readOnly.item",
      "type": "ITEM",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "IN_LIST",
            "propertyId": "5050",
            "path": "region.readOnly.type",
            "hasToExist": true,
            "values": [
              "VAL_OF_ITEM_IN_COND_EQ_COND2",
              "VAL_OF_ITEM_IN_COND_NOT_EQ_COND2",
              "VALUE_OF_ITEM_IN_COND_1_EQ_COND_2",
              "VALUE_OF_ITEM_IN_COND_1_NOT_EQ_COND_2",
              "ITEM_IS_NULL",
              "ITEM_IS_NOT_NULL",
              "ITEM_IS_ZERO",
              "ITEM_IS_NOT_ZERO",
              "ITEM_IS_NULL_OR_ZERO",
              "ITEM_NOT_NULL_OR_ZERO",
              "ITEM_CONTAINS_NO_SPACES",
              "ITEM_IS_NUMERIC",
              "ITEM_IS_NOT_NUMERIC",
              "ITEM_IS_ALPHANUMERIC",
              "VALUE_OF_ITEM_IN_CONDITION_IN_COLON_DELIMITED_LIST",
              "VALUE_OF_ITEM_IN_CONDITION_NOT_IN_COLON_DELIMITED_LIST"
            ]
          }
        ]
      },
      "maxLength": 4000,
      "description": "Item (item) in region.readOnly.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5054",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5054",
      "builderLabel": "List",
      "apexlangPath": "region.readOnly.list",
      "type": "TEXT",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "IN_LIST",
            "propertyId": "5050",
            "path": "region.readOnly.type",
            "hasToExist": true,
            "values": [
              "VALUE_OF_ITEM_IN_CONDITION_IN_COLON_DELIMITED_LIST",
              "VALUE_OF_ITEM_IN_CONDITION_NOT_IN_COLON_DELIMITED_LIST"
            ]
          }
        ]
      },
      "maxLength": 4000,
      "description": "List (text) in region.readOnly.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5055",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5055",
      "builderLabel": "Preference",
      "apexlangPath": "region.readOnly.preference",
      "type": "TEXT",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "IN_LIST",
            "propertyId": "5050",
            "path": "region.readOnly.type",
            "hasToExist": true,
            "values": [
              "USER_PREF_IN_COND_EQ_COND2",
              "USER_PREF_IN_COND_NOT_EQ_COND2"
            ]
          }
        ]
      },
      "maxLength": 4000,
      "description": "Preference (text) in region.readOnly.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5056",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5056",
      "builderLabel": "Page",
      "apexlangPath": "region.readOnly.page",
      "type": "PAGE",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "IN_LIST",
            "propertyId": "5050",
            "path": "region.readOnly.type",
            "hasToExist": true,
            "values": [
              "CURRENT_PAGE_EQUALS_CONDITION",
              "CURRENT_PAGE_NOT_EQUAL_CONDITION"
            ]
          }
        ]
      },
      "maxLength": 4000,
      "description": "Page (page) in region.readOnly.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5057",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5057",
      "builderLabel": "Pages",
      "apexlangPath": "region.readOnly.pages",
      "type": "PAGE",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "IN_LIST",
            "propertyId": "5050",
            "path": "region.readOnly.type",
            "hasToExist": true,
            "values": [
              "CURRENT_PAGE_IN_CONDITION",
              "CURRENT_PAGE_NOT_IN_CONDITION"
            ]
          }
        ]
      },
      "maxLength": 4000,
      "description": "Pages (page) in region.readOnly.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5058",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5058",
      "builderLabel": "Text",
      "apexlangPath": "region.readOnly.text",
      "type": "TEXT",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "IN_LIST",
            "propertyId": "5050",
            "path": "region.readOnly.type",
            "hasToExist": true,
            "values": [
              "CONDITION1_IN_VALUE_OF_ITEM_IN_CONDITION2",
              "DISPLAY_COND_IN_COND_TEXT",
              "DISPLAY_COND_NOT_IN_COND_TEXT",
              "DISPLAY_COND_EQUAL_COND_TEXT",
              "DISP_COND_NOT_EQUAL_COND_TEXT"
            ]
          }
        ]
      },
      "maxLength": 4000,
      "description": "Text (text) in region.readOnly.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5059",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5059",
      "builderLabel": "Value",
      "apexlangPath": "region.readOnly.value",
      "type": "TEXT",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "IN_LIST",
            "propertyId": "5050",
            "path": "region.readOnly.type",
            "hasToExist": true,
            "values": [
              "VAL_OF_ITEM_IN_COND_EQ_COND2",
              "VAL_OF_ITEM_IN_COND_NOT_EQ_COND2",
              "VALUE_OF_ITEM_IN_COND_1_EQ_COND_2",
              "VALUE_OF_ITEM_IN_COND_1_NOT_EQ_COND_2",
              "USER_PREF_IN_COND_EQ_COND2",
              "USER_PREF_IN_COND_NOT_EQ_COND2"
            ]
          }
        ]
      },
      "maxLength": 4000,
      "description": "Value (text) in region.readOnly.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5060",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5060",
      "builderLabel": "Item",
      "apexlangPath": "region.readOnly.item",
      "type": "ITEM",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "5050",
            "path": "region.readOnly.type",
            "hasToExist": true,
            "value": "CONDITION1_IN_VALUE_OF_ITEM_IN_CONDITION2"
          }
        ]
      },
      "maxLength": 4000,
      "description": "Item (item) in region.readOnly.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5061",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5061",
      "builderLabel": "Value",
      "apexlangPath": "region.readOnly.value",
      "type": "TEXT",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "IN_LIST",
            "propertyId": "5050",
            "path": "region.readOnly.type",
            "hasToExist": true,
            "values": [
              "DISPLAY_COND_IN_COND_TEXT",
              "DISPLAY_COND_NOT_IN_COND_TEXT",
              "DISPLAY_COND_EQUAL_COND_TEXT",
              "DISP_COND_NOT_EQUAL_COND_TEXT"
            ]
          }
        ]
      },
      "maxLength": 4000,
      "description": "Value (text) in region.readOnly.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5062",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5062",
      "builderLabel": "Language",
      "apexlangPath": "region.readOnly.language",
      "type": "CODE LANGUAGE",
      "required": true,
      "defaultValue": "PLSQL",
      "values": [
        {
          "name": "sql",
          "returnValue": "SQL",
          "label": "SQL"
        },
        {
          "name": "plsql",
          "returnValue": "PLSQL",
          "label": "PL/SQL"
        },
        {
          "name": "javaScript-mle",
          "returnValue": "JAVASCRIPT",
          "label": "JavaScript (MLE)"
        }
      ],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "5050",
            "path": "region.readOnly.type",
            "hasToExist": true,
            "value": "EXPRESSION"
          }
        ]
      },
      "maxLength": null,
      "description": "Language (code language) in region.readOnly.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5063",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5063",
      "builderLabel": "SQL Expression",
      "apexlangPath": "region.readOnly.sqlExpression",
      "type": "SQL EXPRESSION BOOLEAN",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "5062",
            "path": "region.readOnly.language",
            "hasToExist": true,
            "value": "SQL"
          }
        ]
      },
      "maxLength": 4000,
      "description": "SQL Expression (sql expression boolean) in region.readOnly.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5064",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5064",
      "builderLabel": "PL/SQL Expression",
      "apexlangPath": "region.readOnly.plsqlExpression",
      "type": "PLSQL EXPRESSION BOOLEAN",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "5062",
            "path": "region.readOnly.language",
            "hasToExist": true,
            "value": "PLSQL"
          }
        ]
      },
      "maxLength": 4000,
      "description": "PL/SQL Expression (plsql expression boolean) in region.readOnly.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5065",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5065",
      "builderLabel": "JavaScript Expression",
      "apexlangPath": "region.readOnly.javaScriptExpression",
      "type": "MLE JAVASCRIPT EXPRESSION BOOLEAN",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "5062",
            "path": "region.readOnly.language",
            "hasToExist": true,
            "value": "JAVASCRIPT"
          }
        ]
      },
      "maxLength": 4000,
      "description": "JavaScript Expression (mle javascript expression boolean) in region.readOnly.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5082",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5082",
      "builderLabel": "Language",
      "apexlangPath": "region.readOnly.language",
      "type": "CODE LANGUAGE",
      "required": true,
      "defaultValue": "PLSQL",
      "values": [
        {
          "name": "plsql",
          "returnValue": "PLSQL",
          "label": "PL/SQL"
        },
        {
          "name": "javaScript-mle",
          "returnValue": "JAVASCRIPT",
          "label": "JavaScript (MLE)"
        }
      ],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "5050",
            "path": "region.readOnly.type",
            "hasToExist": true,
            "value": "FUNCTION_BODY"
          }
        ]
      },
      "maxLength": null,
      "description": "Language (code language) in region.readOnly.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5083",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5083",
      "builderLabel": "PL/SQL Function Body",
      "apexlangPath": "region.readOnly.plsqlFunctionBody",
      "type": "PLSQL FUNCTION BODY BOOLEAN",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "5082",
            "path": "region.readOnly.language",
            "hasToExist": true,
            "value": "PLSQL"
          }
        ]
      },
      "maxLength": 4000,
      "description": "PL/SQL Function Body (plsql function body boolean) in region.readOnly.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5084",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5084",
      "builderLabel": "JavaScript Function Body",
      "apexlangPath": "region.readOnly.javaScriptFunctionBody",
      "type": "MLE JAVASCRIPT FUNCTION BODY BOOLEAN",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "5082",
            "path": "region.readOnly.language",
            "hasToExist": true,
            "value": "JAVASCRIPT"
          }
        ]
      },
      "maxLength": 4000,
      "description": "JavaScript Function Body (mle javascript function body boolean) in region.readOnly.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5100",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5100",
      "builderLabel": "Type",
      "apexlangPath": "region.serverSideCondition.type",
      "type": "SELECT LIST",
      "required": false,
      "defaultValue": null,
      "values": [
        {
          "name": "always",
          "returnValue": "ALWAYS",
          "label": "Always"
        },
        {
          "name": "rowsReturned",
          "returnValue": "EXISTS",
          "label": "Rows returned"
        },
        {
          "name": "noRowsReturned",
          "returnValue": "NOT_EXISTS",
          "label": "No Rows returned"
        },
        {
          "name": "expression",
          "returnValue": "EXPRESSION",
          "label": "Expression"
        },
        {
          "name": "functionBody",
          "returnValue": "FUNCTION_BODY",
          "label": "Function Body"
        },
        {
          "name": "request=Value",
          "returnValue": "REQUEST_EQUALS_CONDITION",
          "label": "Request = Value"
        },
        {
          "name": "request!=Value",
          "returnValue": "REQUEST_NOT_EQUAL_CONDITION",
          "label": "Request != Value"
        },
        {
          "name": "requestIsContainedInValue",
          "returnValue": "REQUEST_IN_CONDITION",
          "label": "Request is contained in Value"
        },
        {
          "name": "requestIsNotContainedInValue",
          "returnValue": "REQUEST_NOT_IN_CONDITION",
          "label": "Request is NOT contained in Value"
        },
        {
          "name": "item=value",
          "returnValue": "VAL_OF_ITEM_IN_COND_EQ_COND2",
          "label": "Item = Value"
        },
        {
          "name": "item!=value",
          "returnValue": "VAL_OF_ITEM_IN_COND_NOT_EQ_COND2",
          "label": "Item != Value"
        },
        {
          "name": "itemIsNull",
          "returnValue": "ITEM_IS_NULL",
          "label": "Item is NULL"
        },
        {
          "name": "itemIsNotNull",
          "returnValue": "ITEM_IS_NOT_NULL",
          "label": "Item is NOT NULL"
        },
        {
          "name": "itemIsZero",
          "returnValue": "ITEM_IS_ZERO",
          "label": "Item is zero"
        },
        {
          "name": "itemIsNotZero",
          "returnValue": "ITEM_IS_NOT_ZERO",
          "label": "Item is NOT zero"
        },
        {
          "name": "itemIsNullOrZero",
          "returnValue": "ITEM_IS_NULL_OR_ZERO",
          "label": "Item is NULL or zero"
        },
        {
          "name": "itemIsNotNullAndNotZero",
          "returnValue": "ITEM_NOT_NULL_OR_ZERO",
          "label": "Item is NOT NULL and NOT zero"
        },
        {
          "name": "itemContainsNoSpaces",
          "returnValue": "ITEM_CONTAINS_NO_SPACES",
          "label": "Item contains no spaces"
        },
        {
          "name": "itemIsNumeric",
          "returnValue": "ITEM_IS_NUMERIC",
          "label": "Item is numeric"
        },
        {
          "name": "itemIsNotNumeric",
          "returnValue": "ITEM_IS_NOT_NUMERIC",
          "label": "Item is NOT numeric"
        },
        {
          "name": "itemIsAlphanumeric",
          "returnValue": "ITEM_IS_ALPHANUMERIC",
          "label": "Item is alphanumeric"
        },
        {
          "name": "itemIsInColonDelimitedList",
          "returnValue": "VALUE_OF_ITEM_IN_CONDITION_IN_COLON_DELIMITED_LIST",
          "label": "Item is in colon delimited list"
        },
        {
          "name": "itemIsNotInColonDelimitedList",
          "returnValue": "VALUE_OF_ITEM_IN_CONDITION_NOT_IN_COLON_DELIMITED_LIST",
          "label": "Item is NOT in colon delimited list"
        },
        {
          "name": "textIsContainedInItem",
          "returnValue": "CONDITION1_IN_VALUE_OF_ITEM_IN_CONDITION2",
          "label": "Text is contained in Item"
        },
        {
          "name": "text=value",
          "returnValue": "DISPLAY_COND_EQUAL_COND_TEXT",
          "label": "Text = Value"
        },
        {
          "name": "text!=value",
          "returnValue": "DISP_COND_NOT_EQUAL_COND_TEXT",
          "label": "Text != Value"
        },
        {
          "name": "textIsContainedInValue",
          "returnValue": "DISPLAY_COND_IN_COND_TEXT",
          "label": "Text is contained in Value"
        },
        {
          "name": "textIsNotContainedInValue",
          "returnValue": "DISPLAY_COND_NOT_IN_COND_TEXT",
          "label": "Text is NOT contained in Value"
        },
        {
          "name": "userPreference=value",
          "returnValue": "USER_PREF_IN_COND_EQ_COND2",
          "label": "User Preference = Value"
        },
        {
          "name": "userPreference!=value",
          "returnValue": "USER_PREF_IN_COND_NOT_EQ_COND2",
          "label": "User Preference != Value"
        },
        {
          "name": "currentPage=page",
          "returnValue": "CURRENT_PAGE_EQUALS_CONDITION",
          "label": "Current Page = Page"
        },
        {
          "name": "currentPage!=page",
          "returnValue": "CURRENT_PAGE_NOT_EQUAL_CONDITION",
          "label": "Current Page != Page"
        },
        {
          "name": "currentPageInList",
          "returnValue": "CURRENT_PAGE_IN_CONDITION",
          "label": "Current Page is in comma delimited list"
        },
        {
          "name": "currentPageNotInList",
          "returnValue": "CURRENT_PAGE_NOT_IN_CONDITION",
          "label": "Current Page is NOT in comma delimited list"
        },
        {
          "name": "currentPage=pageSubmitted",
          "returnValue": "WHEN_THIS_PAGE_SUBMITTED",
          "label": "Current Page = Page Submitted (posted)"
        },
        {
          "name": "currentPage!=pageSubmitted",
          "returnValue": "WHEN_THIS_PAGE_NOT_SUBMITTED",
          "label": "Current Page != Page Submitted (posted)"
        },
        {
          "name": "currentPageIsInPrinterFriendlyMode",
          "returnValue": "PAGE_IS_IN_PRINTER_FRIENDLY_MODE",
          "label": "Current Page is in Printer Friendly Mode"
        },
        {
          "name": "currentPageIsNotInPrinterFriendlyMode",
          "returnValue": "PAGE_IS_NOT_IN_PRINTER_FRIENDLY_MODE",
          "label": "Current page is NOT in Printer Friendly Mode"
        },
        {
          "name": "pageRegionIsReadOnly",
          "returnValue": "IS_READ_ONLY",
          "label": "Page/Region is Read Only"
        },
        {
          "name": "pageRegionIsNotReadOnly",
          "returnValue": "IS_NOT_READ_ONLY",
          "label": "Page/Region is NOT Read Only"
        },
        {
          "name": "userIsAuthenticated",
          "returnValue": "USER_IS_NOT_PUBLIC_USER",
          "label": "User is Authenticated (not public)"
        },
        {
          "name": "userIsPublicUser",
          "returnValue": "USER_IS_PUBLIC_USER",
          "label": "User is the Public User (user has not authenticated)"
        },
        {
          "name": "inlineValidationErrorsDisplayed",
          "returnValue": "DISPLAYING_INLINE_VALIDATION_ERRORS",
          "label": "Inline Validation Errors displayed"
        },
        {
          "name": "inlineValidationErrorsNotDisplayed",
          "returnValue": "NOT_DISPLAYING_INLINE_VALIDATION_ERRORS",
          "label": "Inline Validation Errors NOT displayed"
        },
        {
          "name": "sqlReportsOkToShowForwardButton",
          "returnValue": "MAX_ROWS_LT_ROWS_FETCHED",
          "label": "SQL Reports (OK to show the forward button)"
        },
        {
          "name": "sqlReportsOkToShowBackButton",
          "returnValue": "MIN_ROW_GT_THAN_ONE",
          "label": "SQL Reports (OK to show the back button)"
        },
        {
          "name": "currentLanguage=value",
          "returnValue": "CURRENT_LANG_EQ_COND1",
          "label": "Current Language = Value"
        },
        {
          "name": "currentLanguage!=value",
          "returnValue": "CURRENT_LANG_NOT_EQ_COND1",
          "label": "Current Language != Value"
        },
        {
          "name": "currentLanguageIsContainedInValue",
          "returnValue": "CURRENT_LANG_IN_COND1",
          "label": "Current Language is contained in Value"
        },
        {
          "name": "currentLanguageIsNotContainedInValue",
          "returnValue": "CURRENT_LANG_NOT_IN_COND1",
          "label": "Current Language is NOT contained in Value"
        },
        {
          "name": "clientBrowserIsMozilla",
          "returnValue": "BROWSER_IS_NSCP",
          "label": "Client Browser is Mozilla, Netscape 6.x/7x or higher"
        },
        {
          "name": "clientBrowserIsIE7higher",
          "returnValue": "BROWSER_IS_MSIE",
          "label": "Client Browser is Microsoft Internet Explorer 7.0 or higher"
        },
        {
          "name": "clientBrowserIsXhtmlCssCapable",
          "returnValue": "BROWSER_IS_MSIE_OR_NSCP",
          "label": "Client Browser is XHTML / CSS capable browser"
        },
        {
          "name": "clientBrowserIsOther",
          "returnValue": "BROWSER_IS_OTHER",
          "label": "Client Browser is Other browsers (or older version)"
        },
        {
          "name": "cgiEnvDadName=value",
          "returnValue": "DAD_NAME_EQ_CONDITION",
          "label": "CGI_ENV: DAD_NAME = Value"
        },
        {
          "name": "cgiEnvDadName!=value",
          "returnValue": "DAD_NAME_NOT_EQ_CONDITION",
          "label": "CGI_ENV: DAD_NAME != Value"
        },
        {
          "name": "cgiEnvServerName=value",
          "returnValue": "SERVER_NAME_EQ_CONDITION",
          "label": "CGI_ENV: SERVER_NAME = Value"
        },
        {
          "name": "cgiEnvServerName!=value",
          "returnValue": "SERVER_NAME_NOT_EQ_CONDITION",
          "label": "CGI_ENV: SERVER_NAME != Value"
        },
        {
          "name": "cgiEnvHttpHost=value",
          "returnValue": "HTTP_HOST_EQ_CONDITION",
          "label": "CGI_ENV: HTTP_HOST = Value"
        },
        {
          "name": "cgiEnvHttpHost!=value",
          "returnValue": "HTTP_HOST_NOT_EQ_CONDITION",
          "label": "CGI_ENV: HTTP_HOST != Value"
        },
        {
          "name": "never",
          "returnValue": "NEVER",
          "label": "Never"
        }
      ],
      "condition": null,
      "maxLength": null,
      "description": "Type (select list) in region.serverSideCondition.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5101",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5101",
      "builderLabel": "SQL Query",
      "apexlangPath": "region.serverSideCondition.sqlQuery",
      "type": "SQL",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "IN_LIST",
            "propertyId": "5100",
            "path": "region.serverSideCondition.type",
            "hasToExist": true,
            "values": [
              "EXISTS",
              "NOT_EXISTS"
            ]
          }
        ]
      },
      "maxLength": 4000,
      "description": "SQL Query (sql) in region.serverSideCondition.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5102",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5102",
      "builderLabel": "Value",
      "apexlangPath": "region.serverSideCondition.value",
      "type": "TEXT",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "IN_LIST",
            "propertyId": "5100",
            "path": "region.serverSideCondition.type",
            "hasToExist": true,
            "values": [
              "REQUEST_EQUALS_CONDITION",
              "REQUEST_NOT_EQUAL_CONDITION",
              "REQUEST_IN_CONDITION",
              "REQUEST_NOT_IN_CONDITION",
              "CURRENT_LANG_IN_COND1",
              "CURRENT_LANG_NOT_IN_COND1",
              "CURRENT_LANG_NOT_EQ_COND1",
              "CURRENT_LANG_EQ_COND1",
              "DAD_NAME_EQ_CONDITION",
              "DAD_NAME_NOT_EQ_CONDITION",
              "SERVER_NAME_EQ_CONDITION",
              "SERVER_NAME_NOT_EQ_CONDITION",
              "HTTP_HOST_EQ_CONDITION",
              "HTTP_HOST_NOT_EQ_CONDITION"
            ]
          }
        ]
      },
      "maxLength": 4000,
      "description": "Value (text) in region.serverSideCondition.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5103",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5103",
      "builderLabel": "Item",
      "apexlangPath": "region.serverSideCondition.item",
      "type": "ITEM",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "IN_LIST",
            "propertyId": "5100",
            "path": "region.serverSideCondition.type",
            "hasToExist": true,
            "values": [
              "VAL_OF_ITEM_IN_COND_EQ_COND2",
              "VAL_OF_ITEM_IN_COND_NOT_EQ_COND2",
              "VALUE_OF_ITEM_IN_COND_1_EQ_COND_2",
              "VALUE_OF_ITEM_IN_COND_1_NOT_EQ_COND_2",
              "ITEM_IS_NULL",
              "ITEM_IS_NOT_NULL",
              "ITEM_IS_ZERO",
              "ITEM_IS_NOT_ZERO",
              "ITEM_IS_NULL_OR_ZERO",
              "ITEM_NOT_NULL_OR_ZERO",
              "ITEM_CONTAINS_NO_SPACES",
              "ITEM_IS_NUMERIC",
              "ITEM_IS_NOT_NUMERIC",
              "ITEM_IS_ALPHANUMERIC",
              "VALUE_OF_ITEM_IN_CONDITION_IN_COLON_DELIMITED_LIST",
              "VALUE_OF_ITEM_IN_CONDITION_NOT_IN_COLON_DELIMITED_LIST"
            ]
          }
        ]
      },
      "maxLength": 4000,
      "description": "Item (item) in region.serverSideCondition.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5104",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5104",
      "builderLabel": "List",
      "apexlangPath": "region.serverSideCondition.list",
      "type": "TEXT",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "IN_LIST",
            "propertyId": "5100",
            "path": "region.serverSideCondition.type",
            "hasToExist": true,
            "values": [
              "VALUE_OF_ITEM_IN_CONDITION_IN_COLON_DELIMITED_LIST",
              "VALUE_OF_ITEM_IN_CONDITION_NOT_IN_COLON_DELIMITED_LIST"
            ]
          }
        ]
      },
      "maxLength": 4000,
      "description": "List (text) in region.serverSideCondition.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5105",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5105",
      "builderLabel": "Preference",
      "apexlangPath": "region.serverSideCondition.preference",
      "type": "TEXT",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "IN_LIST",
            "propertyId": "5100",
            "path": "region.serverSideCondition.type",
            "hasToExist": true,
            "values": [
              "USER_PREF_IN_COND_EQ_COND2",
              "USER_PREF_IN_COND_NOT_EQ_COND2"
            ]
          }
        ]
      },
      "maxLength": 4000,
      "description": "Preference (text) in region.serverSideCondition.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5106",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5106",
      "builderLabel": "Page",
      "apexlangPath": "region.serverSideCondition.page",
      "type": "PAGE",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "IN_LIST",
            "propertyId": "5100",
            "path": "region.serverSideCondition.type",
            "hasToExist": true,
            "values": [
              "CURRENT_PAGE_EQUALS_CONDITION",
              "CURRENT_PAGE_NOT_EQUAL_CONDITION"
            ]
          }
        ]
      },
      "maxLength": 4000,
      "description": "Page (page) in region.serverSideCondition.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5107",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5107",
      "builderLabel": "Pages",
      "apexlangPath": "region.serverSideCondition.pages",
      "type": "PAGE",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "IN_LIST",
            "propertyId": "5100",
            "path": "region.serverSideCondition.type",
            "hasToExist": true,
            "values": [
              "CURRENT_PAGE_IN_CONDITION",
              "CURRENT_PAGE_NOT_IN_CONDITION"
            ]
          }
        ]
      },
      "maxLength": 4000,
      "description": "Pages (page) in region.serverSideCondition.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5108",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5108",
      "builderLabel": "Text",
      "apexlangPath": "region.serverSideCondition.text",
      "type": "TEXT",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "IN_LIST",
            "propertyId": "5100",
            "path": "region.serverSideCondition.type",
            "hasToExist": true,
            "values": [
              "CONDITION1_IN_VALUE_OF_ITEM_IN_CONDITION2",
              "DISPLAY_COND_IN_COND_TEXT",
              "DISPLAY_COND_NOT_IN_COND_TEXT",
              "DISPLAY_COND_EQUAL_COND_TEXT",
              "DISP_COND_NOT_EQUAL_COND_TEXT"
            ]
          }
        ]
      },
      "maxLength": 4000,
      "description": "Text (text) in region.serverSideCondition.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5109",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5109",
      "builderLabel": "Value",
      "apexlangPath": "region.serverSideCondition.value",
      "type": "TEXT",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "IN_LIST",
            "propertyId": "5100",
            "path": "region.serverSideCondition.type",
            "hasToExist": true,
            "values": [
              "VAL_OF_ITEM_IN_COND_EQ_COND2",
              "VAL_OF_ITEM_IN_COND_NOT_EQ_COND2",
              "VALUE_OF_ITEM_IN_COND_1_EQ_COND_2",
              "VALUE_OF_ITEM_IN_COND_1_NOT_EQ_COND_2"
            ]
          }
        ]
      },
      "maxLength": 4000,
      "description": "Value (text) in region.serverSideCondition.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5110",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5110",
      "builderLabel": "Item",
      "apexlangPath": "region.serverSideCondition.item",
      "type": "ITEM",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "5100",
            "path": "region.serverSideCondition.type",
            "hasToExist": true,
            "value": "CONDITION1_IN_VALUE_OF_ITEM_IN_CONDITION2"
          }
        ]
      },
      "maxLength": 4000,
      "description": "Item (item) in region.serverSideCondition.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5111",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5111",
      "builderLabel": "Value",
      "apexlangPath": "region.serverSideCondition.value",
      "type": "TEXT",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "IN_LIST",
            "propertyId": "5100",
            "path": "region.serverSideCondition.type",
            "hasToExist": true,
            "values": [
              "DISPLAY_COND_IN_COND_TEXT",
              "DISPLAY_COND_NOT_IN_COND_TEXT",
              "DISPLAY_COND_EQUAL_COND_TEXT",
              "DISP_COND_NOT_EQUAL_COND_TEXT"
            ]
          }
        ]
      },
      "maxLength": 4000,
      "description": "Value (text) in region.serverSideCondition.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5112",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5112",
      "builderLabel": "Language",
      "apexlangPath": "region.serverSideCondition.language",
      "type": "CODE LANGUAGE",
      "required": true,
      "defaultValue": "PLSQL",
      "values": [
        {
          "name": "sql",
          "returnValue": "SQL",
          "label": "SQL"
        },
        {
          "name": "plsql",
          "returnValue": "PLSQL",
          "label": "PL/SQL"
        },
        {
          "name": "javaScript-mle",
          "returnValue": "JAVASCRIPT",
          "label": "JavaScript (MLE)"
        }
      ],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "5100",
            "path": "region.serverSideCondition.type",
            "hasToExist": true,
            "value": "EXPRESSION"
          }
        ]
      },
      "maxLength": null,
      "description": "Language (code language) in region.serverSideCondition.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5113",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5113",
      "builderLabel": "SQL Expression",
      "apexlangPath": "region.serverSideCondition.sqlExpression",
      "type": "SQL EXPRESSION BOOLEAN",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "5112",
            "path": "region.serverSideCondition.language",
            "hasToExist": true,
            "value": "SQL"
          }
        ]
      },
      "maxLength": 4000,
      "description": "SQL Expression (sql expression boolean) in region.serverSideCondition.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5114",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5114",
      "builderLabel": "PL/SQL Expression",
      "apexlangPath": "region.serverSideCondition.plsqlExpression",
      "type": "PLSQL EXPRESSION BOOLEAN",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "5112",
            "path": "region.serverSideCondition.language",
            "hasToExist": true,
            "value": "PLSQL"
          }
        ]
      },
      "maxLength": 4000,
      "description": "PL/SQL Expression (plsql expression boolean) in region.serverSideCondition.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5115",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5115",
      "builderLabel": "JavaScript Expression",
      "apexlangPath": "region.serverSideCondition.javaScriptExpression",
      "type": "MLE JAVASCRIPT EXPRESSION BOOLEAN",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "5112",
            "path": "region.serverSideCondition.language",
            "hasToExist": true,
            "value": "JAVASCRIPT"
          }
        ]
      },
      "maxLength": 4000,
      "description": "JavaScript Expression (mle javascript expression boolean) in region.serverSideCondition.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5132",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5132",
      "builderLabel": "Language",
      "apexlangPath": "region.serverSideCondition.language",
      "type": "CODE LANGUAGE",
      "required": true,
      "defaultValue": "PLSQL",
      "values": [
        {
          "name": "plsql",
          "returnValue": "PLSQL",
          "label": "PL/SQL"
        },
        {
          "name": "javaScript-mle",
          "returnValue": "JAVASCRIPT",
          "label": "JavaScript (MLE)"
        }
      ],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "5100",
            "path": "region.serverSideCondition.type",
            "hasToExist": true,
            "value": "FUNCTION_BODY"
          }
        ]
      },
      "maxLength": null,
      "description": "Language (code language) in region.serverSideCondition.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5133",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5133",
      "builderLabel": "PL/SQL Function Body",
      "apexlangPath": "region.serverSideCondition.plsqlFunctionBody",
      "type": "PLSQL FUNCTION BODY BOOLEAN",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "5132",
            "path": "region.serverSideCondition.language",
            "hasToExist": true,
            "value": "PLSQL"
          }
        ]
      },
      "maxLength": 4000,
      "description": "PL/SQL Function Body (plsql function body boolean) in region.serverSideCondition.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5134",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5134",
      "builderLabel": "JavaScript Function Body",
      "apexlangPath": "region.serverSideCondition.javaScriptFunctionBody",
      "type": "MLE JAVASCRIPT FUNCTION BODY BOOLEAN",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "5132",
            "path": "region.serverSideCondition.language",
            "hasToExist": true,
            "value": "JAVASCRIPT"
          }
        ]
      },
      "maxLength": 4000,
      "description": "JavaScript Function Body (mle javascript function body boolean) in region.serverSideCondition.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5360",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5360",
      "builderLabel": "Language",
      "apexlangPath": "region.source.language",
      "type": "CODE LANGUAGE",
      "required": true,
      "defaultValue": "PLSQL",
      "values": [
        {
          "name": "plsql",
          "returnValue": "PLSQL",
          "label": "PL/SQL"
        },
        {
          "name": "javaScript-mle",
          "returnValue": "JAVASCRIPT",
          "label": "JavaScript (MLE)"
        }
      ],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "959",
            "path": "region.source.type",
            "hasToExist": true,
            "value": "FUNC_BODY_RETURNING_SQL"
          }
        ]
      },
      "maxLength": null,
      "description": "Language (code language) in region.source.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5361",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5361",
      "builderLabel": "PL/SQL Function Body returning SQL Query",
      "apexlangPath": "region.source.plsqlFunctionBody",
      "type": "PLSQL FUNCTION BODY SQL",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "5360",
            "path": "region.source.language",
            "hasToExist": true,
            "value": "PLSQL"
          }
        ]
      },
      "maxLength": 32767,
      "description": "PL/SQL Function Body returning SQL Query (plsql function body sql) in region.source.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5362",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5362",
      "builderLabel": "JavaScript Function Body returning SQL Query",
      "apexlangPath": "region.source.javaScriptFunctionBody",
      "type": "MLE JAVASCRIPT FUNCTION BODY SQL",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "5360",
            "path": "region.source.language",
            "hasToExist": true,
            "value": "JAVASCRIPT"
          }
        ]
      },
      "maxLength": 32767,
      "description": "JavaScript Function Body returning SQL Query (mle javascript function body sql) in region.source.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5380",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5380",
      "builderLabel": "Language",
      "apexlangPath": "region.localPostProcessing.language",
      "type": "CODE LANGUAGE",
      "required": true,
      "defaultValue": "PLSQL",
      "values": [
        {
          "name": "plsql",
          "returnValue": "PLSQL",
          "label": "PL/SQL"
        },
        {
          "name": "javaScript-mle",
          "returnValue": "JAVASCRIPT",
          "label": "JavaScript (MLE)"
        }
      ],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "1034",
            "path": "region.localPostProcessing.type",
            "hasToExist": true,
            "value": "FUNC_BODY_RETURNING_SQL"
          }
        ]
      },
      "maxLength": null,
      "description": "Language (code language) in region.localPostProcessing.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5381",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5381",
      "builderLabel": "PL/SQL Function Body returning SQL Query",
      "apexlangPath": "region.localPostProcessing.plsqlFunctionBody",
      "type": "PLSQL FUNCTION BODY SQL",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "5380",
            "path": "region.localPostProcessing.language",
            "hasToExist": true,
            "value": "PLSQL"
          }
        ]
      },
      "maxLength": 32767,
      "description": "PL/SQL Function Body returning SQL Query (plsql function body sql) in region.localPostProcessing.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:5382",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "5382",
      "builderLabel": "JavaScript Function Body returning SQL Query",
      "apexlangPath": "region.localPostProcessing.javaScriptFunctionBody",
      "type": "MLE JAVASCRIPT FUNCTION BODY SQL",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "5380",
            "path": "region.localPostProcessing.language",
            "hasToExist": true,
            "value": "JAVASCRIPT"
          }
        ]
      },
      "maxLength": 32767,
      "description": "JavaScript Function Body returning SQL Query (mle javascript function body sql) in region.localPostProcessing.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:6001",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "6001",
      "builderLabel": "PL/SQL Function Body returning a CLOB",
      "apexlangPath": "region.source.plsqlFunctionBody",
      "type": "PLSQL FUNCTION BODY CLOB",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "6000",
            "path": "region.source.language",
            "hasToExist": true,
            "value": "PLSQL"
          }
        ]
      },
      "maxLength": 32767,
      "description": "PL/SQL Function Body returning a CLOB (plsql function body clob) in region.source.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:6002",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "6002",
      "builderLabel": "JavaScript Function Body returning a String",
      "apexlangPath": "region.source.javaScriptFunctionBody",
      "type": "MLE JAVASCRIPT FUNCTION BODY CLOB",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "6000",
            "path": "region.source.language",
            "hasToExist": true,
            "value": "JAVASCRIPT"
          }
        ]
      },
      "maxLength": 32767,
      "description": "JavaScript Function Body returning a String (mle javascript function body clob) in region.source.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:12171001",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "12171001",
      "builderLabel": "Sample Data",
      "apexlangPath": "region.source.sampleData",
      "type": "SELECT LIST",
      "required": true,
      "defaultValue": null,
      "values": [
        {
          "name": "employees",
          "returnValue": "EMPLOYEES",
          "label": "Employees"
        },
        {
          "name": "tasks",
          "returnValue": "TASKS",
          "label": "Tasks"
        },
        {
          "name": "products",
          "returnValue": "PRODUCTS",
          "label": "Products"
        },
        {
          "name": "projects",
          "returnValue": "PROJECTS",
          "label": "Projects"
        }
      ],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "957",
            "path": "region.source.location",
            "hasToExist": true,
            "value": "SAMPLE_DATA"
          }
        ]
      },
      "maxLength": null,
      "description": "Sample Data (select list) in region.source.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:53520005",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "53520005",
      "builderLabel": "JSON Duality View",
      "apexlangPath": "region.source.jsonDualityView",
      "type": "COMPONENT",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "957",
            "path": "region.source.location",
            "hasToExist": true,
            "value": "DUALITY_VIEW"
          }
        ]
      },
      "maxLength": null,
      "description": "JSON Duality View (component) in region.source.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:53520006",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "53520006",
      "builderLabel": "JSON Source",
      "apexlangPath": "region.source.jsonSource",
      "type": "COMPONENT",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "957",
            "path": "region.source.location",
            "hasToExist": true,
            "value": "JSON_COLLECTION"
          }
        ]
      },
      "maxLength": null,
      "description": "JSON Source (component) in region.source.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:53520009",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "53520009",
      "builderLabel": "Nested Rows",
      "apexlangPath": "region.dataProfile.nestedRows",
      "type": "COMPONENT",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "FEATURES",
            "propertyId": "53520005",
            "path": "region.source.jsonDualityView",
            "hasToExist": true,
            "values": [
              "HAS_ARRAY_COLUMNS"
            ]
          }
        ]
      },
      "maxLength": null,
      "description": "Nested Rows (component) in region.dataProfile.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:53520010",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "53520010",
      "builderLabel": "Nested Rows",
      "apexlangPath": "region.dataProfile.nestedRows",
      "type": "COMPONENT",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "FEATURES",
            "propertyId": "53520006",
            "path": "region.source.jsonSource",
            "hasToExist": true,
            "values": [
              "HAS_ARRAY_COLUMNS"
            ]
          }
        ]
      },
      "maxLength": null,
      "description": "Nested Rows (component) in region.dataProfile.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:53520012",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "53520012",
      "builderLabel": "Type",
      "apexlangPath": "region.localPostProcessing.type",
      "type": "SELECT LIST",
      "required": false,
      "defaultValue": null,
      "values": [
        {
          "name": "whereOrderByClause",
          "returnValue": "WHERE_ORDER_BY_CLAUSE",
          "label": "Where/Order By Clause"
        },
        {
          "name": "sqlQuery",
          "returnValue": "SQL",
          "label": "SQL Query"
        },
        {
          "name": "plsqlFunctionBody",
          "returnValue": "FUNC_BODY_RETURNING_SQL",
          "label": "PL/SQL Function Body returning SQL Query"
        }
      ],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_NULL",
            "propertyId": "53520005",
            "path": "region.source.jsonDualityView",
            "hasToExist": true
          }
        ]
      },
      "maxLength": null,
      "description": "Type (select list) in region.localPostProcessing.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:53520013",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "53520013",
      "builderLabel": "Where Clause",
      "apexlangPath": "region.localPostProcessing.whereClause",
      "type": "WHERE CLAUSE",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "53520012",
            "path": "region.localPostProcessing.type",
            "hasToExist": true,
            "value": "WHERE_ORDER_BY_CLAUSE"
          }
        ]
      },
      "maxLength": 4000,
      "description": "Where Clause (where clause) in region.localPostProcessing.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:53520014",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "53520014",
      "builderLabel": "Order By Clause",
      "apexlangPath": "region.localPostProcessing.orderByClause",
      "type": "ORDER BY CLAUSE",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "53520016",
            "path": "region.localPostProcessing.orderByType",
            "hasToExist": true,
            "value": "STATIC"
          }
        ]
      },
      "maxLength": 255,
      "description": "Order By Clause (order by clause) in region.localPostProcessing.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:53520015",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "53520015",
      "builderLabel": "SQL Query",
      "apexlangPath": "region.localPostProcessing.sqlQuery",
      "type": "SQL",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "53520012",
            "path": "region.localPostProcessing.type",
            "hasToExist": true,
            "value": "SQL"
          }
        ]
      },
      "maxLength": 32767,
      "description": "SQL Query (sql) in region.localPostProcessing.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:53520016",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "53520016",
      "builderLabel": "Order By Type",
      "apexlangPath": "region.localPostProcessing.orderByType",
      "type": "SELECT LIST",
      "required": false,
      "defaultValue": null,
      "values": [
        {
          "name": "staticValue",
          "returnValue": "STATIC",
          "label": "Static Value"
        },
        {
          "name": "item",
          "returnValue": "ITEM",
          "label": "Item"
        }
      ],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "53520012",
            "path": "region.localPostProcessing.type",
            "hasToExist": true,
            "value": "WHERE_ORDER_BY_CLAUSE"
          }
        ]
      },
      "maxLength": null,
      "description": "Order By Type (select list) in region.localPostProcessing.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:53520017",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "53520017",
      "builderLabel": "Item",
      "apexlangPath": "region.localPostProcessing.item",
      "type": "ORDER BY ITEM",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "53520016",
            "path": "region.localPostProcessing.orderByType",
            "hasToExist": true,
            "value": "ITEM"
          }
        ]
      },
      "maxLength": 32767,
      "description": "Item (order by item) in region.localPostProcessing.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:53520018",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "53520018",
      "builderLabel": "Order By Item",
      "apexlangPath": "region.localPostProcessing.orderByItem",
      "type": "ORDER BY ITEM",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "IN_LIST",
            "propertyId": "53520012",
            "path": "region.localPostProcessing.type",
            "hasToExist": true,
            "values": [
              "SQL",
              "FUNC_BODY_RETURNING_SQL"
            ]
          }
        ]
      },
      "maxLength": 32767,
      "description": "Order By Item (order by item) in region.localPostProcessing.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:53520019",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "53520019",
      "builderLabel": "Type",
      "apexlangPath": "region.localPostProcessing.type",
      "type": "SELECT LIST",
      "required": false,
      "defaultValue": null,
      "values": [
        {
          "name": "whereOrderByClause",
          "returnValue": "WHERE_ORDER_BY_CLAUSE",
          "label": "Where/Order By Clause"
        },
        {
          "name": "sqlQuery",
          "returnValue": "SQL",
          "label": "SQL Query"
        },
        {
          "name": "plsqlFunctionBody",
          "returnValue": "FUNC_BODY_RETURNING_SQL",
          "label": "PL/SQL Function Body returning SQL Query"
        }
      ],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_NULL",
            "propertyId": "53520006",
            "path": "region.source.jsonSource",
            "hasToExist": true
          }
        ]
      },
      "maxLength": null,
      "description": "Type (select list) in region.localPostProcessing.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:53520020",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "53520020",
      "builderLabel": "Where Clause",
      "apexlangPath": "region.localPostProcessing.whereClause",
      "type": "WHERE CLAUSE",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "53520019",
            "path": "region.localPostProcessing.type",
            "hasToExist": true,
            "value": "WHERE_ORDER_BY_CLAUSE"
          }
        ]
      },
      "maxLength": 4000,
      "description": "Where Clause (where clause) in region.localPostProcessing.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:53520021",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "53520021",
      "builderLabel": "Order By Clause",
      "apexlangPath": "region.localPostProcessing.orderByClause",
      "type": "ORDER BY CLAUSE",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "53520023",
            "path": "region.localPostProcessing.orderByType",
            "hasToExist": true,
            "value": "STATIC"
          }
        ]
      },
      "maxLength": 255,
      "description": "Order By Clause (order by clause) in region.localPostProcessing.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:53520022",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "53520022",
      "builderLabel": "SQL Query",
      "apexlangPath": "region.localPostProcessing.sqlQuery",
      "type": "SQL",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "53520019",
            "path": "region.localPostProcessing.type",
            "hasToExist": true,
            "value": "SQL"
          }
        ]
      },
      "maxLength": 32767,
      "description": "SQL Query (sql) in region.localPostProcessing.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:53520023",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "53520023",
      "builderLabel": "Order By Type",
      "apexlangPath": "region.localPostProcessing.orderByType",
      "type": "SELECT LIST",
      "required": false,
      "defaultValue": null,
      "values": [
        {
          "name": "staticValue",
          "returnValue": "STATIC",
          "label": "Static Value"
        },
        {
          "name": "item",
          "returnValue": "ITEM",
          "label": "Item"
        }
      ],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "53520019",
            "path": "region.localPostProcessing.type",
            "hasToExist": true,
            "value": "WHERE_ORDER_BY_CLAUSE"
          }
        ]
      },
      "maxLength": null,
      "description": "Order By Type (select list) in region.localPostProcessing.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:53520024",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "53520024",
      "builderLabel": "Item",
      "apexlangPath": "region.localPostProcessing.item",
      "type": "ORDER BY ITEM",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "53520023",
            "path": "region.localPostProcessing.orderByType",
            "hasToExist": true,
            "value": "ITEM"
          }
        ]
      },
      "maxLength": 32767,
      "description": "Item (order by item) in region.localPostProcessing.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:53520025",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "53520025",
      "builderLabel": "Order By Item",
      "apexlangPath": "region.localPostProcessing.orderByItem",
      "type": "ORDER BY ITEM",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "IN_LIST",
            "propertyId": "53520019",
            "path": "region.localPostProcessing.type",
            "hasToExist": true,
            "values": [
              "SQL",
              "FUNC_BODY_RETURNING_SQL"
            ]
          }
        ]
      },
      "maxLength": 32767,
      "description": "Order By Item (order by item) in region.localPostProcessing.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:53520100",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "53520100",
      "builderLabel": "Language",
      "apexlangPath": "region.localPostProcessing.language",
      "type": "CODE LANGUAGE",
      "required": true,
      "defaultValue": "PLSQL",
      "values": [
        {
          "name": "plsql",
          "returnValue": "PLSQL",
          "label": "PL/SQL"
        },
        {
          "name": "javaScript-mle",
          "returnValue": "JAVASCRIPT",
          "label": "JavaScript (MLE)"
        }
      ],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "53520012",
            "path": "region.localPostProcessing.type",
            "hasToExist": true,
            "value": "FUNC_BODY_RETURNING_SQL"
          }
        ]
      },
      "maxLength": null,
      "description": "Language (code language) in region.localPostProcessing.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:53520101",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "53520101",
      "builderLabel": "PL/SQL Function Body returning SQL Query",
      "apexlangPath": "region.localPostProcessing.plsqlFunctionBody",
      "type": "PLSQL FUNCTION BODY SQL",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "53520100",
            "path": "region.localPostProcessing.language",
            "hasToExist": true,
            "value": "PLSQL"
          }
        ]
      },
      "maxLength": 32767,
      "description": "PL/SQL Function Body returning SQL Query (plsql function body sql) in region.localPostProcessing.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:53520102",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "53520102",
      "builderLabel": "JavaScript Function Body returning SQL Query",
      "apexlangPath": "region.localPostProcessing.javaScriptFunctionBody",
      "type": "MLE JAVASCRIPT FUNCTION BODY SQL",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "53520100",
            "path": "region.localPostProcessing.language",
            "hasToExist": true,
            "value": "JAVASCRIPT"
          }
        ]
      },
      "maxLength": 32767,
      "description": "JavaScript Function Body returning SQL Query (mle javascript function body sql) in region.localPostProcessing.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:53520120",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "53520120",
      "builderLabel": "Language",
      "apexlangPath": "region.localPostProcessing.language",
      "type": "CODE LANGUAGE",
      "required": true,
      "defaultValue": "PLSQL",
      "values": [
        {
          "name": "plsql",
          "returnValue": "PLSQL",
          "label": "PL/SQL"
        },
        {
          "name": "javaScript-mle",
          "returnValue": "JAVASCRIPT",
          "label": "JavaScript (MLE)"
        }
      ],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "53520019",
            "path": "region.localPostProcessing.type",
            "hasToExist": true,
            "value": "FUNC_BODY_RETURNING_SQL"
          }
        ]
      },
      "maxLength": null,
      "description": "Language (code language) in region.localPostProcessing.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:53520121",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "53520121",
      "builderLabel": "PL/SQL Function Body returning SQL Query",
      "apexlangPath": "region.localPostProcessing.plsqlFunctionBody",
      "type": "PLSQL FUNCTION BODY SQL",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "53520120",
            "path": "region.localPostProcessing.language",
            "hasToExist": true,
            "value": "PLSQL"
          }
        ]
      },
      "maxLength": 32767,
      "description": "PL/SQL Function Body returning SQL Query (plsql function body sql) in region.localPostProcessing.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:5110:53520122",
      "context": "region",
      "componentTypeId": "5110",
      "componentTitle": "Region",
      "parentContext": "page",
      "parentComponentTypeId": "5000",
      "componentCondition": null,
      "propertyId": "53520122",
      "builderLabel": "JavaScript Function Body returning SQL Query",
      "apexlangPath": "region.localPostProcessing.javaScriptFunctionBody",
      "type": "MLE JAVASCRIPT FUNCTION BODY SQL",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "53520120",
            "path": "region.localPostProcessing.language",
            "hasToExist": true,
            "value": "JAVASCRIPT"
          }
        ]
      },
      "maxLength": 32767,
      "description": "JavaScript Function Body returning SQL Query (mle javascript function body sql) in region.localPostProcessing.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:7000:241",
      "context": "attributes",
      "componentTypeId": "7000",
      "componentTitle": "Attributes",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_IN_LIST",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "NATIVE_SQL_REPORT",
              "NATIVE_TABFORM",
              "NATIVE_IR",
              "NATIVE_IG",
              "NATIVE_JET_CHART",
              "NATIVE_CARDS",
              "NATIVE_MAP_REGION"
            ]
          }
        ]
      },
      "propertyId": "241",
      "builderLabel": "Singular",
      "apexlangPath": "attributes.entityTitle.singular",
      "type": "TEXT",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "243",
            "path": "attributes.componentAppearance.display",
            "hasToExist": true,
            "value": "REPORT"
          }
        ]
      },
      "maxLength": 255,
      "description": "Singular (text) in attributes.entityTitle.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:7000:242",
      "context": "attributes",
      "componentTypeId": "7000",
      "componentTitle": "Attributes",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_IN_LIST",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "NATIVE_SQL_REPORT",
              "NATIVE_TABFORM",
              "NATIVE_IR",
              "NATIVE_IG",
              "NATIVE_JET_CHART",
              "NATIVE_CARDS",
              "NATIVE_MAP_REGION"
            ]
          }
        ]
      },
      "propertyId": "242",
      "builderLabel": "Plural",
      "apexlangPath": "attributes.entityTitle.plural",
      "type": "TEXT",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "243",
            "path": "attributes.componentAppearance.display",
            "hasToExist": true,
            "value": "REPORT"
          }
        ]
      },
      "maxLength": 255,
      "description": "Plural (text) in attributes.entityTitle.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:7000:244",
      "context": "attributes",
      "componentTypeId": "7000",
      "componentTitle": "Attributes",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_IN_LIST",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "NATIVE_SQL_REPORT",
              "NATIVE_TABFORM",
              "NATIVE_IR",
              "NATIVE_IG",
              "NATIVE_JET_CHART",
              "NATIVE_CARDS",
              "NATIVE_MAP_REGION"
            ]
          }
        ]
      },
      "propertyId": "244",
      "builderLabel": "Entities per Page",
      "apexlangPath": "attributes.pagination.entitiesPerPage",
      "type": "INTEGER",
      "required": true,
      "defaultValue": "15",
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "783",
            "path": "attributes.pagination.type",
            "hasToExist": true,
            "value": "SET"
          }
        ]
      },
      "maxLength": 32767,
      "description": "Entities per Page (integer) in attributes.pagination.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:7000:253",
      "context": "attributes",
      "componentTypeId": "7000",
      "componentTitle": "Attributes",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_IN_LIST",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "NATIVE_SQL_REPORT",
              "NATIVE_TABFORM",
              "NATIVE_IR",
              "NATIVE_IG",
              "NATIVE_JET_CHART",
              "NATIVE_CARDS",
              "NATIVE_MAP_REGION"
            ]
          }
        ]
      },
      "propertyId": "253",
      "builderLabel": "Initial Entities Count",
      "apexlangPath": "attributes.pagination.initialEntitiesCount",
      "type": "INTEGER",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "783",
            "path": "attributes.pagination.type",
            "hasToExist": true,
            "value": "SCROLL"
          }
        ]
      },
      "maxLength": 32767,
      "description": "Initial Entities Count (integer) in attributes.pagination.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:7000:297",
      "context": "attributes",
      "componentTypeId": "7000",
      "componentTitle": "Attributes",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_IN_LIST",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "NATIVE_SQL_REPORT",
              "NATIVE_TABFORM",
              "NATIVE_IR",
              "NATIVE_IG",
              "NATIVE_JET_CHART",
              "NATIVE_CARDS",
              "NATIVE_MAP_REGION"
            ]
          }
        ]
      },
      "propertyId": "297",
      "builderLabel": "When No Data Found",
      "apexlangPath": "attributes.messages.whenNoDataFound",
      "type": "TEXT EDITOR",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "FEATURES",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "NO_DATA_FOUND_MESSAGE"
            ]
          },
          {
            "type": "EQUALS",
            "propertyId": "243",
            "path": "attributes.componentAppearance.display",
            "hasToExist": false,
            "value": "REPORT"
          }
        ]
      },
      "maxLength": 4000,
      "description": "When No Data Found (text editor) in attributes.messages.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:7000:298",
      "context": "attributes",
      "componentTypeId": "7000",
      "componentTitle": "Attributes",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_IN_LIST",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "NATIVE_SQL_REPORT",
              "NATIVE_TABFORM",
              "NATIVE_IR",
              "NATIVE_IG",
              "NATIVE_JET_CHART",
              "NATIVE_CARDS",
              "NATIVE_MAP_REGION"
            ]
          }
        ]
      },
      "propertyId": "298",
      "builderLabel": "No Data Found Icon",
      "apexlangPath": "attributes.messages.noDataFoundIcon",
      "type": "ICON",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "FEATURES",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "NO_DATA_FOUND_ICON"
            ]
          },
          {
            "type": "NOT_NULL",
            "propertyId": "297",
            "path": "attributes.messages.whenNoDataFound",
            "hasToExist": true
          }
        ]
      },
      "maxLength": 4000,
      "description": "No Data Found Icon (icon) in attributes.messages.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:7000:427",
      "context": "attributes",
      "componentTypeId": "7000",
      "componentTitle": "Attributes",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_IN_LIST",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "NATIVE_SQL_REPORT",
              "NATIVE_TABFORM",
              "NATIVE_IR",
              "NATIVE_IG",
              "NATIVE_JET_CHART",
              "NATIVE_CARDS",
              "NATIVE_MAP_REGION"
            ]
          }
        ]
      },
      "propertyId": "427",
      "builderLabel": "Type",
      "apexlangPath": "attributes.heading.type",
      "type": "SELECT LIST",
      "required": true,
      "defaultValue": "COLON_DELMITED_LIST",
      "values": [
        {
          "name": "columnNames",
          "returnValue": "QUERY_COLUMNS",
          "label": "Column Names"
        },
        {
          "name": "columnNamesInitcap",
          "returnValue": "QUERY_COLUMNS_INITCAP",
          "label": "Column Names (InitCap)"
        },
        {
          "name": "customHeadings",
          "returnValue": "COLON_DELMITED_LIST",
          "label": "Custom Headings"
        },
        {
          "name": "plsqlFunctionBody",
          "returnValue": "FUNCTION_BODY_RETURNING_COLON_DELIMITED_LIST",
          "label": "PL/SQL Function Body"
        },
        {
          "name": "none",
          "returnValue": "NO_HEADINGS",
          "label": "None"
        }
      ],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "FEATURES",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "COLUMN_HEADING"
            ]
          }
        ]
      },
      "maxLength": null,
      "description": "Type (select list) in attributes.heading.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:7000:428",
      "context": "attributes",
      "componentTypeId": "7000",
      "componentTitle": "Attributes",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_IN_LIST",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "NATIVE_SQL_REPORT",
              "NATIVE_TABFORM",
              "NATIVE_IR",
              "NATIVE_IG",
              "NATIVE_JET_CHART",
              "NATIVE_CARDS",
              "NATIVE_MAP_REGION"
            ]
          }
        ]
      },
      "propertyId": "428",
      "builderLabel": "PL/SQL Function Body",
      "apexlangPath": "attributes.heading.plsqlFunctionBody",
      "type": "PLSQL FUNCTION BODY VARCHAR2",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "427",
            "path": "attributes.heading.type",
            "hasToExist": true,
            "value": "FUNCTION_BODY_RETURNING_COLON_DELIMITED_LIST"
          }
        ]
      },
      "maxLength": 4000,
      "description": "PL/SQL Function Body (plsql function body varchar2) in attributes.heading.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:7000:433",
      "context": "attributes",
      "componentTypeId": "7000",
      "componentTitle": "Attributes",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_IN_LIST",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "NATIVE_SQL_REPORT",
              "NATIVE_TABFORM",
              "NATIVE_IR",
              "NATIVE_IG",
              "NATIVE_JET_CHART",
              "NATIVE_CARDS",
              "NATIVE_MAP_REGION"
            ]
          }
        ]
      },
      "propertyId": "433",
      "builderLabel": "Number of Rows Type",
      "apexlangPath": "attributes.reportLayout.numberOfRowsType",
      "type": "SELECT LIST",
      "required": true,
      "defaultValue": "STATIC",
      "values": [
        {
          "name": "staticValue",
          "returnValue": "STATIC",
          "label": "Static Value"
        },
        {
          "name": "itemValue",
          "returnValue": "ITEM",
          "label": "Based on Item Value"
        }
      ],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "FEATURES",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "FETCHED_ROWS"
            ]
          }
        ]
      },
      "maxLength": null,
      "description": "Number of Rows Type (select list) in attributes.reportLayout.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:7000:434",
      "context": "attributes",
      "componentTypeId": "7000",
      "componentTitle": "Attributes",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_IN_LIST",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "NATIVE_SQL_REPORT",
              "NATIVE_TABFORM",
              "NATIVE_IR",
              "NATIVE_IG",
              "NATIVE_JET_CHART",
              "NATIVE_CARDS",
              "NATIVE_MAP_REGION"
            ]
          }
        ]
      },
      "propertyId": "434",
      "builderLabel": "Number of Rows",
      "apexlangPath": "attributes.reportLayout.numberOfRows",
      "type": "INTEGER",
      "required": true,
      "defaultValue": "15",
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "433",
            "path": "attributes.reportLayout.numberOfRowsType",
            "hasToExist": true,
            "value": "STATIC"
          }
        ]
      },
      "maxLength": 32767,
      "description": "Number of Rows (integer) in attributes.reportLayout.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:7000:435",
      "context": "attributes",
      "componentTypeId": "7000",
      "componentTitle": "Attributes",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_IN_LIST",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "NATIVE_SQL_REPORT",
              "NATIVE_TABFORM",
              "NATIVE_IR",
              "NATIVE_IG",
              "NATIVE_JET_CHART",
              "NATIVE_CARDS",
              "NATIVE_MAP_REGION"
            ]
          }
        ]
      },
      "propertyId": "435",
      "builderLabel": "Item",
      "apexlangPath": "attributes.reportLayout.item",
      "type": "ITEM",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "433",
            "path": "attributes.reportLayout.numberOfRowsType",
            "hasToExist": true,
            "value": "ITEM"
          }
        ]
      },
      "maxLength": 255,
      "description": "Item (item) in attributes.reportLayout.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:7000:453",
      "context": "attributes",
      "componentTypeId": "7000",
      "componentTitle": "Attributes",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_IN_LIST",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "NATIVE_SQL_REPORT",
              "NATIVE_TABFORM",
              "NATIVE_IR",
              "NATIVE_IG",
              "NATIVE_JET_CHART",
              "NATIVE_CARDS",
              "NATIVE_MAP_REGION"
            ]
          }
        ]
      },
      "propertyId": "453",
      "builderLabel": "Type",
      "apexlangPath": "attributes.rowSelection.type",
      "type": "SELECT LIST",
      "required": false,
      "defaultValue": null,
      "values": [
        {
          "name": "focusOnly",
          "returnValue": "FOCUS",
          "label": "Focus only"
        },
        {
          "name": "singleSelection",
          "returnValue": "SINGLE",
          "label": "Single Selection"
        },
        {
          "name": "multipleSelection",
          "returnValue": "MULTIPLE",
          "label": "Multiple Selection"
        }
      ],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "FEATURES",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "ROW_SELECTION"
            ]
          },
          {
            "type": "EQUALS",
            "propertyId": "243",
            "path": "attributes.componentAppearance.display",
            "hasToExist": true,
            "value": "REPORT"
          }
        ]
      },
      "maxLength": null,
      "description": "Type (select list) in attributes.rowSelection.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:7000:454",
      "context": "attributes",
      "componentTypeId": "7000",
      "componentTitle": "Attributes",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_IN_LIST",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "NATIVE_SQL_REPORT",
              "NATIVE_TABFORM",
              "NATIVE_IR",
              "NATIVE_IG",
              "NATIVE_JET_CHART",
              "NATIVE_CARDS",
              "NATIVE_MAP_REGION"
            ]
          }
        ]
      },
      "propertyId": "454",
      "builderLabel": "Current Selection Page Item",
      "apexlangPath": "attributes.rowSelection.currentSelectionPageItem",
      "type": "ITEM",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "IN_LIST",
            "propertyId": "453",
            "path": "attributes.rowSelection.type",
            "hasToExist": true,
            "values": [
              "SINGLE",
              "MULTIPLE"
            ]
          }
        ]
      },
      "maxLength": 255,
      "description": "Current Selection Page Item (item) in attributes.rowSelection.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:7000:455",
      "context": "attributes",
      "componentTypeId": "7000",
      "componentTitle": "Attributes",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_IN_LIST",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "NATIVE_SQL_REPORT",
              "NATIVE_TABFORM",
              "NATIVE_IR",
              "NATIVE_IG",
              "NATIVE_JET_CHART",
              "NATIVE_CARDS",
              "NATIVE_MAP_REGION"
            ]
          }
        ]
      },
      "propertyId": "455",
      "builderLabel": "Select All Page Item",
      "apexlangPath": "attributes.rowSelection.selectAllPageItem",
      "type": "ITEM",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "453",
            "path": "attributes.rowSelection.type",
            "hasToExist": true,
            "value": "MULTIPLE"
          }
        ]
      },
      "maxLength": 255,
      "description": "Select All Page Item (item) in attributes.rowSelection.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:7000:556",
      "context": "attributes",
      "componentTypeId": "7000",
      "componentTitle": "Attributes",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_IN_LIST",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "NATIVE_SQL_REPORT",
              "NATIVE_TABFORM",
              "NATIVE_IR",
              "NATIVE_IG",
              "NATIVE_JET_CHART",
              "NATIVE_CARDS",
              "NATIVE_MAP_REGION"
            ]
          }
        ]
      },
      "propertyId": "556",
      "builderLabel": "Template Options",
      "apexlangPath": "attributes.componentAppearance.templateOptions",
      "type": "TEMPLATE OPTIONS",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "OR",
        "conditions": [
          {
            "type": "NOT_NULL",
            "propertyId": "387",
            "path": "attributes.componentAppearance.breadcrumbTemplate",
            "hasToExist": true
          },
          {
            "type": "NOT_NULL",
            "propertyId": "386",
            "path": "attributes.componentAppearance.listTemplate",
            "hasToExist": true
          }
        ]
      },
      "maxLength": null,
      "description": "Template Options (template options) in attributes.componentAppearance.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:7000:559",
      "context": "attributes",
      "componentTypeId": "7000",
      "componentTitle": "Attributes",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_IN_LIST",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "NATIVE_SQL_REPORT",
              "NATIVE_TABFORM",
              "NATIVE_IR",
              "NATIVE_IG",
              "NATIVE_JET_CHART",
              "NATIVE_CARDS",
              "NATIVE_MAP_REGION"
            ]
          }
        ]
      },
      "propertyId": "559",
      "builderLabel": "Initialization JavaScript Function",
      "apexlangPath": "attributes.componentAdvanced.initJavaScriptFunction",
      "type": "JAVASCRIPT",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "FEATURES",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "INIT_JAVASCRIPT_CODE"
            ]
          }
        ]
      },
      "maxLength": 4000,
      "description": "Initialization JavaScript Function (javascript) in attributes.componentAdvanced.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:7000:770",
      "context": "attributes",
      "componentTypeId": "7000",
      "componentTitle": "Attributes",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_IN_LIST",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "NATIVE_SQL_REPORT",
              "NATIVE_TABFORM",
              "NATIVE_IR",
              "NATIVE_IG",
              "NATIVE_JET_CHART",
              "NATIVE_CARDS",
              "NATIVE_MAP_REGION"
            ]
          }
        ]
      },
      "propertyId": "770",
      "builderLabel": "Enabled",
      "apexlangPath": "attributes.edit.enabled",
      "type": "YES NO",
      "required": true,
      "defaultValue": "N",
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "FEATURES",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "EDITABLE"
            ]
          }
        ]
      },
      "maxLength": 32767,
      "description": "Enabled (yes no) in attributes.edit.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:7000:771",
      "context": "attributes",
      "componentTypeId": "7000",
      "componentTitle": "Attributes",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_IN_LIST",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "NATIVE_SQL_REPORT",
              "NATIVE_TABFORM",
              "NATIVE_IR",
              "NATIVE_IG",
              "NATIVE_JET_CHART",
              "NATIVE_CARDS",
              "NATIVE_MAP_REGION"
            ]
          }
        ]
      },
      "propertyId": "771",
      "builderLabel": "Allowed Operations",
      "apexlangPath": "attributes.edit.allowedOperations",
      "type": "CHECKBOXES",
      "required": false,
      "defaultValue": null,
      "values": [
        {
          "name": "add",
          "returnValue": "i",
          "label": "Add Row"
        },
        {
          "name": "update",
          "returnValue": "u",
          "label": "Update Row"
        },
        {
          "name": "delete",
          "returnValue": "d",
          "label": "Delete Row"
        }
      ],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "770",
            "path": "attributes.edit.enabled",
            "hasToExist": true,
            "value": "Y"
          }
        ]
      },
      "maxLength": null,
      "description": "Allowed Operations (checkboxes) in attributes.edit.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:7000:772",
      "context": "attributes",
      "componentTypeId": "7000",
      "componentTitle": "Attributes",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_IN_LIST",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "NATIVE_SQL_REPORT",
              "NATIVE_TABFORM",
              "NATIVE_IR",
              "NATIVE_IG",
              "NATIVE_JET_CHART",
              "NATIVE_CARDS",
              "NATIVE_MAP_REGION"
            ]
          }
        ]
      },
      "propertyId": "772",
      "builderLabel": "Allowed Row Operations Column",
      "apexlangPath": "attributes.edit.allowedRowOperationsColumn",
      "type": "REGION COLUMN",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "IN_LIST",
            "propertyId": "771",
            "path": "attributes.edit.allowedOperations",
            "hasToExist": true,
            "values": [
              "u",
              "d"
            ]
          }
        ]
      },
      "maxLength": 32767,
      "description": "Allowed Row Operations Column (region column) in attributes.edit.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:7000:773",
      "context": "attributes",
      "componentTypeId": "7000",
      "componentTitle": "Attributes",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_IN_LIST",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "NATIVE_SQL_REPORT",
              "NATIVE_TABFORM",
              "NATIVE_IR",
              "NATIVE_IG",
              "NATIVE_JET_CHART",
              "NATIVE_CARDS",
              "NATIVE_MAP_REGION"
            ]
          }
        ]
      },
      "propertyId": "773",
      "builderLabel": "Add",
      "apexlangPath": "attributes.editAuthorization.add",
      "type": "COMPONENT",
      "required": false,
      "defaultValue": null,
      "values": [
        {
          "name": "mustNotBePublicUser",
          "returnValue": "MUST_NOT_BE_PUBLIC_USER",
          "label": "MODEL.LOV.MUST_NOT_BE_PUBLIC_USER"
        }
      ],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "771",
            "path": "attributes.edit.allowedOperations",
            "hasToExist": true,
            "value": "i"
          }
        ]
      },
      "maxLength": null,
      "description": "Add (component) in attributes.editAuthorization.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:7000:774",
      "context": "attributes",
      "componentTypeId": "7000",
      "componentTitle": "Attributes",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_IN_LIST",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "NATIVE_SQL_REPORT",
              "NATIVE_TABFORM",
              "NATIVE_IR",
              "NATIVE_IG",
              "NATIVE_JET_CHART",
              "NATIVE_CARDS",
              "NATIVE_MAP_REGION"
            ]
          }
        ]
      },
      "propertyId": "774",
      "builderLabel": "Update",
      "apexlangPath": "attributes.editAuthorization.update",
      "type": "COMPONENT",
      "required": false,
      "defaultValue": null,
      "values": [
        {
          "name": "mustNotBePublicUser",
          "returnValue": "MUST_NOT_BE_PUBLIC_USER",
          "label": "MODEL.LOV.MUST_NOT_BE_PUBLIC_USER"
        }
      ],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "771",
            "path": "attributes.edit.allowedOperations",
            "hasToExist": true,
            "value": "u"
          }
        ]
      },
      "maxLength": null,
      "description": "Update (component) in attributes.editAuthorization.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:7000:775",
      "context": "attributes",
      "componentTypeId": "7000",
      "componentTitle": "Attributes",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_IN_LIST",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "NATIVE_SQL_REPORT",
              "NATIVE_TABFORM",
              "NATIVE_IR",
              "NATIVE_IG",
              "NATIVE_JET_CHART",
              "NATIVE_CARDS",
              "NATIVE_MAP_REGION"
            ]
          }
        ]
      },
      "propertyId": "775",
      "builderLabel": "Delete",
      "apexlangPath": "attributes.editAuthorization.delete",
      "type": "COMPONENT",
      "required": false,
      "defaultValue": null,
      "values": [
        {
          "name": "mustNotBePublicUser",
          "returnValue": "MUST_NOT_BE_PUBLIC_USER",
          "label": "MODEL.LOV.MUST_NOT_BE_PUBLIC_USER"
        }
      ],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "771",
            "path": "attributes.edit.allowedOperations",
            "hasToExist": true,
            "value": "d"
          }
        ]
      },
      "maxLength": null,
      "description": "Delete (component) in attributes.editAuthorization.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:7000:776",
      "context": "attributes",
      "componentTypeId": "7000",
      "componentTitle": "Attributes",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_IN_LIST",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "NATIVE_SQL_REPORT",
              "NATIVE_TABFORM",
              "NATIVE_IR",
              "NATIVE_IG",
              "NATIVE_JET_CHART",
              "NATIVE_CARDS",
              "NATIVE_MAP_REGION"
            ]
          }
        ]
      },
      "propertyId": "776",
      "builderLabel": "Lost Update Type",
      "apexlangPath": "attributes.edit.lostUpdateType",
      "type": "SELECT LIST",
      "required": true,
      "defaultValue": "VALUES",
      "values": [
        {
          "name": "rowValues",
          "returnValue": "VALUES",
          "label": "Row Values"
        },
        {
          "name": "rowVersionColumn",
          "returnValue": "COLUMN",
          "label": "Row Version Column"
        }
      ],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "770",
            "path": "attributes.edit.enabled",
            "hasToExist": true,
            "value": "Y"
          }
        ]
      },
      "maxLength": null,
      "description": "Lost Update Type (select list) in attributes.edit.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:7000:777",
      "context": "attributes",
      "componentTypeId": "7000",
      "componentTitle": "Attributes",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_IN_LIST",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "NATIVE_SQL_REPORT",
              "NATIVE_TABFORM",
              "NATIVE_IR",
              "NATIVE_IG",
              "NATIVE_JET_CHART",
              "NATIVE_CARDS",
              "NATIVE_MAP_REGION"
            ]
          }
        ]
      },
      "propertyId": "777",
      "builderLabel": "Row Version Column",
      "apexlangPath": "attributes.edit.rowVersionColumn",
      "type": "REGION COLUMN",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "776",
            "path": "attributes.edit.lostUpdateType",
            "hasToExist": true,
            "value": "COLUMN"
          }
        ]
      },
      "maxLength": 32767,
      "description": "Row Version Column (region column) in attributes.edit.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:7000:780",
      "context": "attributes",
      "componentTypeId": "7000",
      "componentTitle": "Attributes",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_IN_LIST",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "NATIVE_SQL_REPORT",
              "NATIVE_TABFORM",
              "NATIVE_IR",
              "NATIVE_IG",
              "NATIVE_JET_CHART",
              "NATIVE_CARDS",
              "NATIVE_MAP_REGION"
            ]
          }
        ]
      },
      "propertyId": "780",
      "builderLabel": "Lazy Loading",
      "apexlangPath": "attributes.performance.lazyLoading",
      "type": "YES NO",
      "required": true,
      "defaultValue": "N",
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "FEATURES",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "LAZY_LOADING"
            ]
          },
          {
            "type": "NOT_NULL",
            "propertyId": "957",
            "path": "region.source.location",
            "hasToExist": true
          }
        ]
      },
      "maxLength": 32767,
      "description": "Lazy Loading (yes no) in attributes.performance.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:7000:783",
      "context": "attributes",
      "componentTypeId": "7000",
      "componentTitle": "Attributes",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_IN_LIST",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "NATIVE_SQL_REPORT",
              "NATIVE_TABFORM",
              "NATIVE_IR",
              "NATIVE_IG",
              "NATIVE_JET_CHART",
              "NATIVE_CARDS",
              "NATIVE_MAP_REGION"
            ]
          }
        ]
      },
      "propertyId": "783",
      "builderLabel": "Type",
      "apexlangPath": "attributes.pagination.type",
      "type": "SELECT LIST",
      "required": true,
      "defaultValue": "SET",
      "values": [
        {
          "name": "page",
          "returnValue": "SET",
          "label": "Page"
        },
        {
          "name": "scroll",
          "returnValue": "SCROLL",
          "label": "Scroll"
        }
      ],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "243",
            "path": "attributes.componentAppearance.display",
            "hasToExist": true,
            "value": "REPORT"
          }
        ]
      },
      "maxLength": null,
      "description": "Type (select list) in attributes.pagination.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:7000:784",
      "context": "attributes",
      "componentTypeId": "7000",
      "componentTitle": "Attributes",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_IN_LIST",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "NATIVE_SQL_REPORT",
              "NATIVE_TABFORM",
              "NATIVE_IR",
              "NATIVE_IG",
              "NATIVE_JET_CHART",
              "NATIVE_CARDS",
              "NATIVE_MAP_REGION"
            ]
          }
        ]
      },
      "propertyId": "784",
      "builderLabel": "Show Total Count",
      "apexlangPath": "attributes.pagination.showTotalCount",
      "type": "YES NO",
      "required": true,
      "defaultValue": "N",
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "243",
            "path": "attributes.componentAppearance.display",
            "hasToExist": true,
            "value": "REPORT"
          }
        ]
      },
      "maxLength": 32767,
      "description": "Show Total Count (yes no) in attributes.pagination.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:7000:1132",
      "context": "attributes",
      "componentTypeId": "7000",
      "componentTitle": "Attributes",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_IN_LIST",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "NATIVE_SQL_REPORT",
              "NATIVE_TABFORM",
              "NATIVE_IR",
              "NATIVE_IG",
              "NATIVE_JET_CHART",
              "NATIVE_CARDS",
              "NATIVE_MAP_REGION"
            ]
          }
        ]
      },
      "propertyId": "1132",
      "builderLabel": "CSS Classes",
      "apexlangPath": "attributes.componentAppearance.cssClasses",
      "type": "COMBOBOX",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "STARTS_WITH_ANY",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "NATIVE_BREADCRUMB",
              "NATIVE_LIST",
              "TMPL_"
            ]
          }
        ]
      },
      "maxLength": 255,
      "description": "CSS Classes (combobox) in attributes.componentAppearance.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:7000:2422",
      "context": "attributes",
      "componentTypeId": "7000",
      "componentTitle": "Attributes",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_IN_LIST",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "NATIVE_SQL_REPORT",
              "NATIVE_TABFORM",
              "NATIVE_IR",
              "NATIVE_IG",
              "NATIVE_JET_CHART",
              "NATIVE_CARDS",
              "NATIVE_MAP_REGION"
            ]
          }
        ]
      },
      "propertyId": "2422",
      "builderLabel": "Lazy Loading",
      "apexlangPath": "attributes.performance.lazyLoading",
      "type": "YES NO",
      "required": true,
      "defaultValue": "N",
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "FEATURES",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "LAZY_LOADING_ALWAYS"
            ]
          }
        ]
      },
      "maxLength": 32767,
      "description": "Lazy Loading (yes no) in attributes.performance.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:7000:89890006",
      "context": "attributes",
      "componentTypeId": "7000",
      "componentTitle": "Attributes",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_IN_LIST",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "NATIVE_SQL_REPORT",
              "NATIVE_TABFORM",
              "NATIVE_IR",
              "NATIVE_IG",
              "NATIVE_JET_CHART",
              "NATIVE_CARDS",
              "NATIVE_MAP_REGION"
            ]
          }
        ]
      },
      "propertyId": "89890006",
      "builderLabel": "Enabled",
      "apexlangPath": "attributes.genAI.enabled",
      "type": "YES NO",
      "required": true,
      "defaultValue": "N",
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "FEATURES",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "AI_ENABLED"
            ]
          }
        ]
      },
      "maxLength": 32767,
      "description": "Enabled (yes no) in attributes.genAI.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:7000:89890007",
      "context": "attributes",
      "componentTypeId": "7000",
      "componentTitle": "Attributes",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_IN_LIST",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "NATIVE_SQL_REPORT",
              "NATIVE_TABFORM",
              "NATIVE_IR",
              "NATIVE_IG",
              "NATIVE_JET_CHART",
              "NATIVE_CARDS",
              "NATIVE_MAP_REGION"
            ]
          }
        ]
      },
      "propertyId": "89890007",
      "builderLabel": "Agent",
      "apexlangPath": "attributes.genAI.agent",
      "type": "COMPONENT",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "FEATURES",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "AI_ENABLED_ALWAYS",
              "AI_ENABLED"
            ]
          },
          {
            "type": "EQUALS",
            "propertyId": "89890006",
            "path": "attributes.genAI.enabled",
            "hasToExist": false,
            "value": "Y"
          }
        ]
      },
      "maxLength": null,
      "description": "Agent (component) in attributes.genAI.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:7000:89890008",
      "context": "attributes",
      "componentTypeId": "7000",
      "componentTitle": "Attributes",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_IN_LIST",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "NATIVE_SQL_REPORT",
              "NATIVE_TABFORM",
              "NATIVE_IR",
              "NATIVE_IG",
              "NATIVE_JET_CHART",
              "NATIVE_CARDS",
              "NATIVE_MAP_REGION"
            ]
          }
        ]
      },
      "propertyId": "89890008",
      "builderLabel": "Service",
      "apexlangPath": "attributes.genAI.service",
      "type": "COMPONENT",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NULL",
            "propertyId": "89890007",
            "path": "attributes.genAI.agent",
            "hasToExist": true
          }
        ]
      },
      "maxLength": null,
      "description": "Service (component) in attributes.genAI.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:7000:89890009",
      "context": "attributes",
      "componentTypeId": "7000",
      "componentTitle": "Attributes",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_IN_LIST",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "NATIVE_SQL_REPORT",
              "NATIVE_TABFORM",
              "NATIVE_IR",
              "NATIVE_IG",
              "NATIVE_JET_CHART",
              "NATIVE_CARDS",
              "NATIVE_MAP_REGION"
            ]
          }
        ]
      },
      "propertyId": "89890009",
      "builderLabel": "System Prompt",
      "apexlangPath": "attributes.genAI.systemPrompt",
      "type": "TEXT EDITOR",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "FEATURES",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "AI_SYSTEM_PROMPT"
            ]
          },
          {
            "type": "NULL",
            "propertyId": "89890007",
            "path": "attributes.genAI.agent",
            "hasToExist": true
          }
        ]
      },
      "maxLength": 32767,
      "description": "System Prompt (text editor) in attributes.genAI.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:7000:89890010",
      "context": "attributes",
      "componentTypeId": "7000",
      "componentTitle": "Attributes",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_IN_LIST",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "NATIVE_SQL_REPORT",
              "NATIVE_TABFORM",
              "NATIVE_IR",
              "NATIVE_IG",
              "NATIVE_JET_CHART",
              "NATIVE_CARDS",
              "NATIVE_MAP_REGION"
            ]
          }
        ]
      },
      "propertyId": "89890010",
      "builderLabel": "Welcome Message",
      "apexlangPath": "attributes.genAI.welcomeMessage",
      "type": "HTML",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "FEATURES",
            "propertyId": "94",
            "path": "region.type",
            "hasToExist": true,
            "values": [
              "AI_UI"
            ]
          },
          {
            "type": "NULL",
            "propertyId": "89890007",
            "path": "attributes.genAI.agent",
            "hasToExist": true
          }
        ]
      },
      "maxLength": 32767,
      "description": "Welcome Message (html) in attributes.genAI.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:8000:76",
      "context": "parameter",
      "componentTypeId": "8000",
      "componentTitle": "Parameter",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_NULL",
            "propertyId": "967",
            "path": "region.source.restSource",
            "hasToExist": true
          },
          {
            "type": "EQUALS",
            "propertyId": "1112",
            "path": "region.restSynchronization.useLocalTable",
            "hasToExist": false,
            "value": "N"
          }
        ]
      },
      "propertyId": "76",
      "builderLabel": "Static Value",
      "apexlangPath": "parameter.value.staticValue",
      "type": "SELECT LIST",
      "required": true,
      "defaultValue": null,
      "values": [
        {
          "name": "true",
          "returnValue": "TRUE",
          "label": "True"
        },
        {
          "name": "false",
          "returnValue": "FALSE",
          "label": "False"
        }
      ],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "1005",
            "path": "parameter.value.type",
            "hasToExist": true,
            "value": "STATIC"
          },
          {
            "type": "FEATURES",
            "propertyId": "1004",
            "path": "parameter.name",
            "hasToExist": true,
            "values": [
              "BOOLEAN_PARAMETER"
            ]
          }
        ]
      },
      "maxLength": null,
      "description": "Static Value (select list) in parameter.value.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:8000:184",
      "context": "parameter",
      "componentTypeId": "8000",
      "componentTitle": "Parameter",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_NULL",
            "propertyId": "967",
            "path": "region.source.restSource",
            "hasToExist": true
          },
          {
            "type": "EQUALS",
            "propertyId": "1112",
            "path": "region.restSynchronization.useLocalTable",
            "hasToExist": false,
            "value": "N"
          }
        ]
      },
      "propertyId": "184",
      "builderLabel": "True Value",
      "apexlangPath": "parameter.value.trueValue",
      "type": "TEXT",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "FEATURES",
            "propertyId": "1004",
            "path": "parameter.name",
            "hasToExist": true,
            "values": [
              "BOOLEAN_PARAMETER"
            ]
          },
          {
            "type": "IN_LIST",
            "propertyId": "1005",
            "path": "parameter.value.type",
            "hasToExist": true,
            "values": [
              "ITEM",
              "PREFERENCE"
            ]
          }
        ]
      },
      "maxLength": 10,
      "description": "True Value (text) in parameter.value.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:8000:185",
      "context": "parameter",
      "componentTypeId": "8000",
      "componentTitle": "Parameter",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_NULL",
            "propertyId": "967",
            "path": "region.source.restSource",
            "hasToExist": true
          },
          {
            "type": "EQUALS",
            "propertyId": "1112",
            "path": "region.restSynchronization.useLocalTable",
            "hasToExist": false,
            "value": "N"
          }
        ]
      },
      "propertyId": "185",
      "builderLabel": "False Value",
      "apexlangPath": "parameter.value.falseValue",
      "type": "TEXT",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "FEATURES",
            "propertyId": "1004",
            "path": "parameter.name",
            "hasToExist": true,
            "values": [
              "BOOLEAN_PARAMETER"
            ]
          },
          {
            "type": "IN_LIST",
            "propertyId": "1005",
            "path": "parameter.value.type",
            "hasToExist": true,
            "values": [
              "ITEM",
              "PREFERENCE"
            ]
          }
        ]
      },
      "maxLength": 10,
      "description": "False Value (text) in parameter.value.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:8000:235",
      "context": "parameter",
      "componentTypeId": "8000",
      "componentTitle": "Parameter",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_NULL",
            "propertyId": "967",
            "path": "region.source.restSource",
            "hasToExist": true
          },
          {
            "type": "EQUALS",
            "propertyId": "1112",
            "path": "region.restSynchronization.useLocalTable",
            "hasToExist": false,
            "value": "N"
          }
        ]
      },
      "propertyId": "235",
      "builderLabel": "Format Mask",
      "apexlangPath": "parameter.value.formatMask",
      "type": "COMBOBOX",
      "required": false,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "FEATURES",
            "propertyId": "1004",
            "path": "parameter.name",
            "hasToExist": true,
            "values": [
              "NUMBER_PARAMETER",
              "DATE_PARAMETER",
              "TIMESTAMP_PARAMETER",
              "TIMESTAMP_TZ_PARAMETER"
            ]
          },
          {
            "type": "IN_LIST",
            "propertyId": "1005",
            "path": "parameter.value.type",
            "hasToExist": true,
            "values": [
              "STATIC",
              "ITEM",
              "PREFERENCE"
            ]
          }
        ]
      },
      "maxLength": 255,
      "description": "Format Mask (combobox) in parameter.value.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:8000:1004",
      "context": "parameter",
      "componentTypeId": "8000",
      "componentTitle": "Parameter",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_NULL",
            "propertyId": "967",
            "path": "region.source.restSource",
            "hasToExist": true
          },
          {
            "type": "EQUALS",
            "propertyId": "1112",
            "path": "region.restSynchronization.useLocalTable",
            "hasToExist": false,
            "value": "N"
          }
        ]
      },
      "propertyId": "1004",
      "builderLabel": "Name",
      "apexlangPath": "parameter.name",
      "type": "COMPONENT",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": null,
      "maxLength": null,
      "description": "Name (component) in parameter.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:8000:1005",
      "context": "parameter",
      "componentTypeId": "8000",
      "componentTitle": "Parameter",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_NULL",
            "propertyId": "967",
            "path": "region.source.restSource",
            "hasToExist": true
          },
          {
            "type": "EQUALS",
            "propertyId": "1112",
            "path": "region.restSynchronization.useLocalTable",
            "hasToExist": false,
            "value": "N"
          }
        ]
      },
      "propertyId": "1005",
      "builderLabel": "Type",
      "apexlangPath": "parameter.value.type",
      "type": "SELECT LIST",
      "required": true,
      "defaultValue": null,
      "values": [
        {
          "name": "staticValue",
          "returnValue": "STATIC",
          "label": "Static Value"
        },
        {
          "name": "restSourceDefault",
          "returnValue": "DEFAULT",
          "label": "REST Source Default"
        },
        {
          "name": "item",
          "returnValue": "ITEM",
          "label": "Item"
        },
        {
          "name": "sqlQuery",
          "returnValue": "SQL_QUERY",
          "label": "SQL Query (return single value)"
        },
        {
          "name": "expression",
          "returnValue": "EXPRESSION",
          "label": "Expression"
        },
        {
          "name": "functionBody",
          "returnValue": "FUNCTION_BODY",
          "label": "Function Body"
        },
        {
          "name": "collectionClob",
          "returnValue": "COLLECTION",
          "label": "Collection (CLOB)"
        },
        {
          "name": "preference",
          "returnValue": "PREFERENCE",
          "label": "Preference"
        },
        {
          "name": "parentColumn",
          "returnValue": "PARENT_COLUMN",
          "label": "Parent Column"
        },
        {
          "name": "null",
          "returnValue": "NULL",
          "label": "Null"
        }
      ],
      "condition": {
        "operator": "OR",
        "conditions": [
          {
            "type": "FEATURES",
            "propertyId": "1004",
            "path": "parameter.name",
            "hasToExist": true,
            "values": [
              "IN_PARAMETER",
              "IN_OUT_PARAMETER"
            ]
          },
          {
            "type": "EQUALS",
            "propertyId": "35",
            "path": "parameter.parameter.ignoreOutput",
            "hasToExist": true,
            "value": "N"
          }
        ]
      },
      "maxLength": null,
      "description": "Type (select list) in parameter.value.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:8000:1006",
      "context": "parameter",
      "componentTypeId": "8000",
      "componentTitle": "Parameter",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_NULL",
            "propertyId": "967",
            "path": "region.source.restSource",
            "hasToExist": true
          },
          {
            "type": "EQUALS",
            "propertyId": "1112",
            "path": "region.restSynchronization.useLocalTable",
            "hasToExist": false,
            "value": "N"
          }
        ]
      },
      "propertyId": "1006",
      "builderLabel": "Static Value",
      "apexlangPath": "parameter.value.staticValue",
      "type": "TEXT EDITOR",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "1005",
            "path": "parameter.value.type",
            "hasToExist": true,
            "value": "STATIC"
          },
          {
            "type": "NOT_FEATURES",
            "propertyId": "1004",
            "path": "parameter.name",
            "hasToExist": true,
            "values": [
              "BOOLEAN_PARAMETER"
            ]
          }
        ]
      },
      "maxLength": 4000,
      "description": "Static Value (text editor) in parameter.value.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:8000:1007",
      "context": "parameter",
      "componentTypeId": "8000",
      "componentTitle": "Parameter",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_NULL",
            "propertyId": "967",
            "path": "region.source.restSource",
            "hasToExist": true
          },
          {
            "type": "EQUALS",
            "propertyId": "1112",
            "path": "region.restSynchronization.useLocalTable",
            "hasToExist": false,
            "value": "N"
          }
        ]
      },
      "propertyId": "1007",
      "builderLabel": "SQL Query",
      "apexlangPath": "parameter.value.sqlQuery",
      "type": "SQL",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "1005",
            "path": "parameter.value.type",
            "hasToExist": true,
            "value": "SQL_QUERY"
          }
        ]
      },
      "maxLength": 4000,
      "description": "SQL Query (sql) in parameter.value.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:8000:1009",
      "context": "parameter",
      "componentTypeId": "8000",
      "componentTitle": "Parameter",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_NULL",
            "propertyId": "967",
            "path": "region.source.restSource",
            "hasToExist": true
          },
          {
            "type": "EQUALS",
            "propertyId": "1112",
            "path": "region.restSynchronization.useLocalTable",
            "hasToExist": false,
            "value": "N"
          }
        ]
      },
      "propertyId": "1009",
      "builderLabel": "Item",
      "apexlangPath": "parameter.value.item",
      "type": "ITEM",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "1005",
            "path": "parameter.value.type",
            "hasToExist": true,
            "value": "ITEM"
          }
        ]
      },
      "maxLength": 255,
      "description": "Item (item) in parameter.value.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:8000:1012",
      "context": "parameter",
      "componentTypeId": "8000",
      "componentTitle": "Parameter",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_NULL",
            "propertyId": "967",
            "path": "region.source.restSource",
            "hasToExist": true
          },
          {
            "type": "EQUALS",
            "propertyId": "1112",
            "path": "region.restSynchronization.useLocalTable",
            "hasToExist": false,
            "value": "N"
          }
        ]
      },
      "propertyId": "1012",
      "builderLabel": "Preference",
      "apexlangPath": "parameter.value.preference",
      "type": "TEXT",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "1005",
            "path": "parameter.value.type",
            "hasToExist": true,
            "value": "PREFERENCE"
          }
        ]
      },
      "maxLength": 255,
      "description": "Preference (text) in parameter.value.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:8000:1015",
      "context": "parameter",
      "componentTypeId": "8000",
      "componentTitle": "Parameter",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_NULL",
            "propertyId": "967",
            "path": "region.source.restSource",
            "hasToExist": true
          },
          {
            "type": "EQUALS",
            "propertyId": "1112",
            "path": "region.restSynchronization.useLocalTable",
            "hasToExist": false,
            "value": "N"
          }
        ]
      },
      "propertyId": "1015",
      "builderLabel": "Name",
      "apexlangPath": "parameter.value.name",
      "type": "TEXT",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "1005",
            "path": "parameter.value.type",
            "hasToExist": true,
            "value": "COLLECTION"
          }
        ]
      },
      "maxLength": 255,
      "description": "Name (text) in parameter.value.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:8000:2381",
      "context": "parameter",
      "componentTypeId": "8000",
      "componentTitle": "Parameter",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_NULL",
            "propertyId": "967",
            "path": "region.source.restSource",
            "hasToExist": true
          },
          {
            "type": "EQUALS",
            "propertyId": "1112",
            "path": "region.restSynchronization.useLocalTable",
            "hasToExist": false,
            "value": "N"
          }
        ]
      },
      "propertyId": "2381",
      "builderLabel": "Column",
      "apexlangPath": "parameter.value.column",
      "type": "COMPONENT",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "1005",
            "path": "parameter.value.type",
            "hasToExist": true,
            "value": "PARENT_COLUMN"
          }
        ]
      },
      "maxLength": null,
      "description": "Column (component) in parameter.value.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:8000:6060",
      "context": "parameter",
      "componentTypeId": "8000",
      "componentTitle": "Parameter",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_NULL",
            "propertyId": "967",
            "path": "region.source.restSource",
            "hasToExist": true
          },
          {
            "type": "EQUALS",
            "propertyId": "1112",
            "path": "region.restSynchronization.useLocalTable",
            "hasToExist": false,
            "value": "N"
          }
        ]
      },
      "propertyId": "6060",
      "builderLabel": "Language",
      "apexlangPath": "parameter.value.language",
      "type": "CODE LANGUAGE",
      "required": true,
      "defaultValue": "PLSQL",
      "values": [
        {
          "name": "sql",
          "returnValue": "SQL",
          "label": "SQL"
        },
        {
          "name": "plsql",
          "returnValue": "PLSQL",
          "label": "PL/SQL"
        },
        {
          "name": "javaScript-mle",
          "returnValue": "JAVASCRIPT",
          "label": "JavaScript (MLE)"
        }
      ],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "1005",
            "path": "parameter.value.type",
            "hasToExist": true,
            "value": "EXPRESSION"
          }
        ]
      },
      "maxLength": null,
      "description": "Language (code language) in parameter.value.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:8000:6061",
      "context": "parameter",
      "componentTypeId": "8000",
      "componentTitle": "Parameter",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_NULL",
            "propertyId": "967",
            "path": "region.source.restSource",
            "hasToExist": true
          },
          {
            "type": "EQUALS",
            "propertyId": "1112",
            "path": "region.restSynchronization.useLocalTable",
            "hasToExist": false,
            "value": "N"
          }
        ]
      },
      "propertyId": "6061",
      "builderLabel": "SQL Expression",
      "apexlangPath": "parameter.value.sqlExpression",
      "type": "SQL EXPRESSION CUSTOM",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "6060",
            "path": "parameter.value.language",
            "hasToExist": true,
            "value": "SQL"
          }
        ]
      },
      "maxLength": 4000,
      "description": "SQL Expression (sql expression custom) in parameter.value.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:8000:6062",
      "context": "parameter",
      "componentTypeId": "8000",
      "componentTitle": "Parameter",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_NULL",
            "propertyId": "967",
            "path": "region.source.restSource",
            "hasToExist": true
          },
          {
            "type": "EQUALS",
            "propertyId": "1112",
            "path": "region.restSynchronization.useLocalTable",
            "hasToExist": false,
            "value": "N"
          }
        ]
      },
      "propertyId": "6062",
      "builderLabel": "PL/SQL Expression",
      "apexlangPath": "parameter.value.plsqlExpression",
      "type": "PLSQL EXPRESSION CUSTOM",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "6060",
            "path": "parameter.value.language",
            "hasToExist": true,
            "value": "PLSQL"
          }
        ]
      },
      "maxLength": 4000,
      "description": "PL/SQL Expression (plsql expression custom) in parameter.value.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:8000:6063",
      "context": "parameter",
      "componentTypeId": "8000",
      "componentTitle": "Parameter",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_NULL",
            "propertyId": "967",
            "path": "region.source.restSource",
            "hasToExist": true
          },
          {
            "type": "EQUALS",
            "propertyId": "1112",
            "path": "region.restSynchronization.useLocalTable",
            "hasToExist": false,
            "value": "N"
          }
        ]
      },
      "propertyId": "6063",
      "builderLabel": "JavaScript Expression",
      "apexlangPath": "parameter.value.javaScriptExpression",
      "type": "MLE JAVASCRIPT EXPRESSION CUSTOM",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "6060",
            "path": "parameter.value.language",
            "hasToExist": true,
            "value": "JAVASCRIPT"
          }
        ]
      },
      "maxLength": 4000,
      "description": "JavaScript Expression (mle javascript expression custom) in parameter.value.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:8000:6080",
      "context": "parameter",
      "componentTypeId": "8000",
      "componentTitle": "Parameter",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_NULL",
            "propertyId": "967",
            "path": "region.source.restSource",
            "hasToExist": true
          },
          {
            "type": "EQUALS",
            "propertyId": "1112",
            "path": "region.restSynchronization.useLocalTable",
            "hasToExist": false,
            "value": "N"
          }
        ]
      },
      "propertyId": "6080",
      "builderLabel": "Language",
      "apexlangPath": "parameter.value.language",
      "type": "CODE LANGUAGE",
      "required": true,
      "defaultValue": "PLSQL",
      "values": [
        {
          "name": "plsql",
          "returnValue": "PLSQL",
          "label": "PL/SQL"
        },
        {
          "name": "javaScript-mle",
          "returnValue": "JAVASCRIPT",
          "label": "JavaScript (MLE)"
        }
      ],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "1005",
            "path": "parameter.value.type",
            "hasToExist": true,
            "value": "FUNCTION_BODY"
          }
        ]
      },
      "maxLength": null,
      "description": "Language (code language) in parameter.value.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:8000:6081",
      "context": "parameter",
      "componentTypeId": "8000",
      "componentTitle": "Parameter",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_NULL",
            "propertyId": "967",
            "path": "region.source.restSource",
            "hasToExist": true
          },
          {
            "type": "EQUALS",
            "propertyId": "1112",
            "path": "region.restSynchronization.useLocalTable",
            "hasToExist": false,
            "value": "N"
          }
        ]
      },
      "propertyId": "6081",
      "builderLabel": "PL/SQL Function Body",
      "apexlangPath": "parameter.value.plsqlFunctionBody",
      "type": "PLSQL FUNCTION BODY CUSTOM",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "6080",
            "path": "parameter.value.language",
            "hasToExist": true,
            "value": "PLSQL"
          }
        ]
      },
      "maxLength": 4000,
      "description": "PL/SQL Function Body (plsql function body custom) in parameter.value.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    },
    {
      "id": "mmd:8000:6082",
      "context": "parameter",
      "componentTypeId": "8000",
      "componentTitle": "Parameter",
      "parentContext": "region",
      "parentComponentTypeId": "5110",
      "componentCondition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "NOT_NULL",
            "propertyId": "967",
            "path": "region.source.restSource",
            "hasToExist": true
          },
          {
            "type": "EQUALS",
            "propertyId": "1112",
            "path": "region.restSynchronization.useLocalTable",
            "hasToExist": false,
            "value": "N"
          }
        ]
      },
      "propertyId": "6082",
      "builderLabel": "JavaScript Function Body",
      "apexlangPath": "parameter.value.javaScriptFunctionBody",
      "type": "MLE JAVASCRIPT FUNCTION BODY CUSTOM",
      "required": true,
      "defaultValue": null,
      "values": [],
      "condition": {
        "operator": "AND",
        "conditions": [
          {
            "type": "EQUALS",
            "propertyId": "6080",
            "path": "parameter.value.language",
            "hasToExist": true,
            "value": "JAVASCRIPT"
          }
        ]
      },
      "maxLength": 4000,
      "description": "JavaScript Function Body (mle javascript function body custom) in parameter.value.",
      "descriptionOrigin": "apexrest-factual-summary",
      "source": "SQLcl MMD 26.1.0+3102",
      "sourceHasHelp": false,
      "nativeType": null
    }
  ],
  "currentExamples": {
    "regions": [
      {
        "id": "page:1903/region:help-example",
        "pageId": 1903,
        "key": "help-example",
        "type": "helpText",
        "template": "Content Block",
        "componentTemplate": null,
        "regionOptions": [
          "#DEFAULT#",
          "t-ContentBlock--h2"
        ],
        "componentOptions": [],
        "settings": {}
      }
    ],
    "items": [],
    "buttons": [],
    "pages": []
  }
}
```

Complete option groups, defaults, presets and source context are available in component:source/parameters.
