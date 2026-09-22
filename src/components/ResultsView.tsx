import { getTranslations } from 'next-intl/server';
import { formatDisplayDate } from '@/lib/dates';
import type { ConnectingJourney, DirectTrain, TrainClass } from '@/lib/types';
import type { SearchReport } from '@/lib/search';
import type { SearchCriteria } from '@/lib/validation';

const classNames = (classes: TrainClass[]) => classes.map((c) => c.name).join(', ');

export async function ResultsView({ report, criteria }: { report: SearchReport; criteria: SearchCriteria }) {
  const t = await getTranslations('result');
  const { outcome, suggestion, prices, totalDistance } = report;
  const bold = (chunks: React.ReactNode) => <strong>{chunks}</strong>;
  const flag = (chunks: React.ReactNode) => <span className="flag">{chunks}</span>;

  let message: string | null = null;
  if (outcome.statusCode === '2000') {
    message = t('messages.found', { count: outcome.resultCount });
  } else if (outcome.statusCode === '2001') {
    message = t('messages.none');
    if (suggestion) {
      message += t('messages.separator') + t('messages.viaJunction', {
        junction: suggestion.junctionStation,
        from: suggestion.fromStation,
        to: suggestion.toStation,
      });
    }
  }

  return (
    <>
      <h2 className="result-query">
        {t.rich('query', {
          from: outcome.query.startStation,
          to: outcome.query.endStation,
          date: formatDisplayDate(outcome.query.date || criteria.date),
          startTime: outcome.query.startTime || criteria.start,
          endTime: outcome.query.endTime || criteria.end,
          b: bold,
        })}
      </h2>
      {message && (
        <p className="result-message" role="status">
          <strong>{message}</strong>
        </p>
      )}

      {outcome.directTrains.length > 0 && <DirectTrains trains={outcome.directTrains} />}

      {outcome.connectingJourneys.length > 0 && (
        <section aria-labelledby="connecting-title" className="panel">
          <h3 id="connecting-title">{t('connecting.title')}</h3>
          {outcome.connectingJourneys.map((journey, index) => (
            <Journey key={index} journey={journey} />
          ))}
          <p className="hint">{t.rich('connecting.transitNote', { flag, b: bold })}</p>
        </section>
      )}

      {prices.length > 0 && (
        <section aria-labelledby="price-title" className="panel">
          <h3 id="price-title">{t('price.title')}</h3>
          <div className="table-wrap">
            <table className="table table--compact">
              <thead>
                <tr>
                  <th scope="col">{t('price.className')}</th>
                  <th scope="col" className="num">
                    {t('price.price')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {prices.map((price) => (
                  <tr key={price.className}>
                    <td>{price.className}</td>
                    <td className="num">{price.priceLkr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalDistance && (
            <p>
              <strong>{t('price.totalDistance')}:</strong> {totalDistance}
            </p>
          )}
        </section>
      )}
    </>
  );
}

async function DirectTrains({ trains }: { trains: DirectTrain[] }) {
  const t = await getTranslations('result.direct');
  const bold = (chunks: React.ReactNode) => <strong>{chunks}</strong>;

  return (
    <section aria-labelledby="direct-title" className="panel">
      <h3 id="direct-title">{t('title')}</h3>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">{t('headers.startStation')}</th>
              <th scope="col">{t('headers.arrivalTime')}</th>
              <th scope="col">{t('headers.departureTime')}</th>
              <th scope="col">{t('headers.destinationAndTime')}</th>
              <th scope="col">{t('headers.endStationAndTime')}</th>
              <th scope="col">{t('headers.frequency')}</th>
              <th scope="col">{t('headers.name')}</th>
              <th scope="col">{t('headers.type')}</th>
            </tr>
          </thead>
          {trains.map((train, index) => (
            <tbody key={`${train.id}-${index}`}>
              <tr>
                <td>{train.startStation}</td>
                <td className="time time--arrival">{train.arrivalTime}</td>
                <td className="time time--departure">{train.departureTime}</td>
                <td>
                  {train.finalStation} {train.arrivalTimeAtFinalStation}
                </td>
                <td>
                  {train.endStation} {train.arrivalTimeAtEndStation}
                </td>
                <td>{train.frequency}</td>
                <td>{train.name}</td>
                <td>{train.type}</td>
              </tr>
              <tr className="table__extra">
                <td colSpan={3}>
                  {train.classes.length > 0 && (
                    <>
                      <strong>{t('availableClasses')}:</strong> {classNames(train.classes)}
                    </>
                  )}
                </td>
                <td colSpan={3}>
                  {t.rich('endsAt', {
                    station: train.finalStation,
                    time: train.arrivalTimeAtFinalStation,
                    b: bold,
                  })}
                </td>
                <td colSpan={2}>
                  <strong>{t('trainNo')}:</strong> {train.number}
                </td>
              </tr>
            </tbody>
          ))}
        </table>
      </div>
    </section>
  );
}

async function Journey({ journey }: { journey: ConnectingJourney }) {
  const t = await getTranslations('result.connecting');

  return (
    <details className="journey">
      <summary>
        <dl className="journey__summary">
          <div>
            <dt>{t('headers.startStation')}</dt>
            <dd>{journey.startStation}</dd>
          </div>
          <div>
            <dt>{t('headers.arrivalTime')}</dt>
            <dd className="time time--arrival">{journey.startArrivalTime}</dd>
          </div>
          <div>
            <dt>{t('headers.departureTime')}</dt>
            <dd className="time time--departure">{journey.startDepartureTime}</dd>
          </div>
          <div>
            <dt>{t('headers.destination')}</dt>
            <dd>{journey.endStation}</dd>
          </div>
          <div>
            <dt>{t('headers.arrivalTimeDestination')}</dt>
            <dd>{journey.endArrivalTime}</dd>
          </div>
        </dl>
        <span className="journey__toggle">
          <span className="journey__more">{t('more')}</span>
          <span className="journey__less">{t('less')}</span>
        </span>
      </summary>
      <h4>{t('trainList')}</h4>
      <div className="table-wrap">
        <table className="table table--legs">
          <thead>
            <tr>
              <th scope="col">{t('legHeaders.startStation')}</th>
              <th scope="col">{t('legHeaders.startTime')}</th>
              <th scope="col">{t('legHeaders.endStation')}</th>
              <th scope="col">{t('legHeaders.endTime')}</th>
              <th scope="col">{t('legHeaders.name')}</th>
              <th scope="col">{t('legHeaders.trainNo')}</th>
              <th scope="col">{t('legHeaders.availableClasses')}</th>
            </tr>
          </thead>
          <tbody>
            {journey.legs.map((leg, index) => (
              <tr key={index}>
                <td>{leg.startStation}</td>
                <td>{leg.startTime}</td>
                <td>
                  {leg.endStation} {leg.isTransit && <span className="flag">T</span>}
                </td>
                <td>{leg.endTime}</td>
                <td>{leg.trainName}</td>
                <td>{leg.trainNumber}</td>
                <td>{classNames(leg.classes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
