import moment from 'moment';

export const calculateNextRun = ({ interval, starts }) => {

  const startsMoment = moment.unix(starts);
  const hour = startsMoment.hour();
  const minute = startsMoment.minute();
  const nowMoment = moment();
  const dayOfWeek = startsMoment.day(); // All weekly intervals start on the same day as the campaign start value.

  let nextRunTime;

  switch (interval) {

    case 1: // Set nextRunTime to the next weekday after now.
      nextRunTime = nowMoment.clone().hour(hour).minute(minute).second(0);

      // Find the next weekday (Monday to Friday)
      while (nextRunTime.isoWeekday() >= 6 || nextRunTime.isBefore(nowMoment)) {
        nextRunTime.add(1, 'days');
      }
      break;
  
    case 2: // Set nextRunTime for the next day.
      nextRunTime = nowMoment.clone().add(1, 'days').hour(hour).minute(minute);
      break;
  
    case 3: // Set nextRunTime to one week.
      console.log(moment.unix(nextRunTime).format('dddd, MMMM Do YYYY, h:mm:ss a'));
      nextRunTime = nowMoment.clone().add(7, 'days').day(dayOfWeek).hour(hour).minute(minute);
      break;
  
    case 4: // Set nextRunTime to two weeks.
      nextRunTime = nowMoment.clone().add(2, 'weeks').day(dayOfWeek).hour(hour).minute(minute);
      break;
  
    case 5: // Set nextRunTime to one month.
      nextRunTime = nowMoment.clone().add(1, 'months').day(dayOfWeek).hour(hour).minute(minute);
      break;
  
    case 6: // Set nextRunTime to the first day of the next month.
      nextRunTime = nowMoment.clone().add(1, 'months').startOf('month').hour(hour).minute(minute);
      break;
  
    case 7: // Set nextRunTime to the first weekday of the next month.
      nextRunTime = nowMoment.clone().add(1, 'months').startOf('month').isoWeekday(1).hour(hour).minute(minute);
      break;
  
    case 8: // Set nextRunTime to three months from now (quarterly).
      nextRunTime = nowMoment.clone().add(3, 'months').hour(hour).minute(minute);
      break;
  
    case 9: // Set nextRunTime to the first day of the next quarter.
      nextRunTime = nowMoment.clone().add(1, 'quarters').startOf('quarter').hour(hour).minute(minute);
      break;
  
    case 10: // Set nextRunTime to the first weekday of the next quarter.
      nextRunTime = nowMoment.clone().add(1, 'quarters').startOf('quarter').isoWeekday(1).hour(hour).minute(minute);
      break;
  
    case 11: // Set nextRunTime to six months from now (semiannual).
      nextRunTime = nowMoment.clone().add(6, 'months').hour(hour).minute(minute);
      break;
  
    case 12: // Set nextRunTime to the first day of the next semiannual.
      nextRunTime = nowMoment.clone().add(6, 'months').startOf('month').hour(hour).minute(minute);
      break;
  
    case 13: // Set nextRunTime to the first weekday of the next semiannual.
      nextRunTime = nowMoment.clone().add(6, 'months').startOf('month').isoWeekday(1).hour(hour).minute(minute);
      break;
  
    case 14: // Set nextRunTime to one year from now.
      nextRunTime = nowMoment.clone().add(1, 'years').hour(hour).minute(minute);
      break;
  
    case 15: // Set nextRunTime to the first day of the next year.
      nextRunTime = nowMoment.clone().add(1, 'years').startOf('month').hour(hour).minute(minute);
      break;
  
    case 16: // Set nextRunTime to the first weekday of the next year.
      nextRunTime = nowMoment.clone().add(1, 'years').startOf('month').isoWeekday(1).hour(hour).minute(minute);
      break;
  
    default:
      throw new Error('Invalid interval');
  }
  
  // Return the next run time as a UNIX timestamp.

  return +nextRunTime.format('X');

};