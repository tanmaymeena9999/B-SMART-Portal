export const KPI_WORKSHOPS = [
  { key: "ws1", label: "WS1 (Suzuki Garage)" },
  { key: "ws2", label: "WS2 (Ahmadi Garage)" },
  { key: "ws3", label: "WS3 (Shuwaikh Garage)" },
  { key: "ws4", label: "Dealer 4 / WS 4" },
  { key: "total", label: "Total" },
  { key: "workshopLocation", label: "Workshop Location" },
];

export const KPI_ROWS = [
  ["1", "Welcome Call to new vehicle customers\n(Refer SQS 1 Annexure 1.5)", "Total number of vehicles sold in the month"],
  ["", "", "Total number of customers contacted"],
  ["2", "Service Appointments\n(Refer SQS 1 Annexure 2.6)", "Total number of vehicles received for service, through appointment"],
  ["3", "Vehicle Holdup - Service\n(Refer SQS 3 Annexure 2.3)", "Number of vehicles heldup in service for >3 days (Daily average)"],
  ["", "", "Number of service vehicles heldup >3 day, due to want of parts"],
  ["4", "Quality Inspection (Final Inspection)\n(Refer SQS 4 Annexure 1.4)", "Total number of Quality Inspections done after service of vehicle"],
  ["5", "Washing Quality\n(Refer SQS 3 Annexure 4.1)", "Total Number of Washing audits done"],
  ["6", "Service Quality - Repeat Jobs\n(Refer SQS 4 Annexure 2.1)", "Total number of vehicles received for repeat jobs"],
  ["7", "Customer Satisfaction\n(Refer SQS 6 Annexure 2.2)", "Number of customers due for PSF (JC closed in last month)"],
  ["", "", "Number of customers contacted (A)"],
  ["", "", "Number of customer satisfied (B)"],
  ["", "", "%age Satisfaction (B/A)"],
  ["8", "Google Business Listing", "Workshop location created on Google Business listing"],
  ["", "", "Google Listing optimized (Y/N)"],
  ["9", "SQS Training Done", "Total Number of SQS training courses done in the month"],
  ["", "", "Total Number of people trained in SQS"],
  ["10", "SSQS Certified Manpower", "Total Number of SSQS Bronze certified Manpower"],
  ["", "", "Total Number of SSQS Silver certified Manpower"],
  ["", "", "Total Number of SSQS Gold certified Manpower"],
  ["11", "Service Promotion\n(Refer SQS 7 Annexure 1.3)", "1. Name of promotional activity"],
  ["", "", "1. Number of customers attended"],
  ["", "", "1. Duration of activity in days"],
  ["", "", "2. Name of promotional activity, if more than 1 activities are done"],
  ["", "", "2. Number of customers attended, if more than 1 activities are done"],
  ["", "", "2. Duration of activity in days"],
  ["12", "Extended Warranty & Service Contracts", "Is Extended Warranty being offered to customers? (Y/N)"],
  ["", "", "Total number Extended Warranty Sold this month"],
  ["", "", "IS Service Contacts/Annual Maintenance Contracts being offered to customers? (Y/N)"],
  ["", "", "Total number of Service Contacts Sold this month"],
  ["13", "In-House training\n(Refer SQS 8 Annexure 2.1)", "1. Name Of the training"],
  ["", "", "1. Duration of training in days"],
  ["", "", "1. Number of participants in training"],
  ["", "", "2. Name of training if more than 1 training are done"],
  ["", "", "2. Duration of training, if more than 1 training are done"],
  ["", "", "2. Number of participants in training, if more than 1 training is done"],
  ["14", "Due Vs Done Monitoring", "1st Service - Number of vehicles Due"],
  ["", "", "1st Service - Number of vehicles Done"],
  ["", "", "2nd Service - Number of vehicles Due"],
  ["", "", "2nd Service - Number of vehicles Done"],
  ["", "", "3rd Service - Number of vehicles Due"],
  ["", "", "3rd Service - Number of vehicles Done"],
  ["", "", "4th Service - Number of vehicles Due"],
  ["", "", "4th Service - Number of vehicles Done"],
  ["", "", "5th Service - Number of vehicles Due"],
  ["", "", "5th Service - Number of vehicles Done"],
  ["", "", "6th Service - Number of vehicles Due"],
  ["", "", "6th Service - Number of vehicles Done"],
  ["", "", "7th Service - Number of vehicles Due"],
  ["", "", "7th Service - Number of vehicles Done"],
  ["", "", "8th Service - Number of vehicles Due"],
  ["", "", "8th Service - Number of vehicles Done"],
  ["", "", "9th Service - Number of vehicles Due"],
  ["", "", "9th Service - Number of vehicles Done"],
  ["", "", "10th Service - Number of vehicles Due"],
  ["", "", "10th Service - Number of vehicles Done"],
];

export function buildDefaultKpiRows() {
  let lastSrNo = "";
  let lastParameter = "";

  return KPI_ROWS.map(([srNo, parameter, detailsRequired], index) => {
    lastSrNo = srNo || lastSrNo;
    lastParameter = parameter || lastParameter;

    return {
      id: `additional-kpi-row-${index + 1}`,
      srNo: lastSrNo,
      parameter: lastParameter,
      detailsRequired,
      values: KPI_WORKSHOPS.reduce((values, workshop) => {
        values[workshop.key] = "";
        return values;
      }, {}),
      remarks: "",
    };
  });
}
