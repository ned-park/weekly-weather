import React, { useEffect, useState } from "react";

import * as uniqId from 'uniqid';
import Layout from "~/components/layout/Layout";
import LoadingSpinner from "~/components/Loading";
import Modal from "~/components/Modal";
import WeatherCharts from "~/components/WeatherCharts";
import WeatherTable from "~/components/WeatherTable";
import { weatherIcons } from "~/utils/hashmaps";
import { toast } from "react-hot-toast";
import { api } from "~/utils/api";
import { useUser } from "@clerk/nextjs";

import type { Forecast } from "~/interfaces/forecast";
import type { LatLong } from "~/interfaces/latlong";
import type { Place } from "~/interfaces/place";
import DailyHighLow from "~/components/DailyHighLow";

const SetDefaultLocation = ({ location }: { location: { name: string, id: string } }) => {
  const { mutate } = api.userLocation.setDefaultLocation.useMutation({
    onSuccess: () => {
      toast.success(`Default Location is now ${location.name}`);
    },
    onError: (e) => {
      const errorMessage = e.data?.zodError?.fieldErrors.content;
      if (errorMessage && errorMessage[0]) {
        toast.error(errorMessage[0]);
      } else {
        toast.error("Failed to change default location! Please try again later.");
      }
    },
  });

  return (
    <button
      className="bg-sky-500 rounded p-2  px-4"
      onClick={() => mutate({ locationId: location.id })}
    >
      Make Default
    </button>
  )
}

function Weather() {
  const { user } = useUser();

  const [query, setQuery] = useState('');
  const [location, setLocation] = useState({ name: '', id: '' });
  const [latLong, setLatLong] = useState<LatLong>({ latitude: "", longitude: "" });
  const [forecast, setForecast] = useState<Forecast>();
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [day, setDay] = useState(0);
  const [placeQuery, setPlaceQuery] = useState('');

  useEffect(() => {
    const getDefaultLocation = async () => {

      interface DefaultLocationResponse {
        result: {
          data: {
            json: {
              id: string;
              name: string;
              admin1: string;
              admin2: string;
              admin3: string;
              latitude: number;
              longitude: number;
              elevation: number;
              country: string;
            }
          }
        };
      }

      const res = await fetch(`/api/trpc/userLocation.getDefaultLocation`);

      if (res.ok) {
        const data = await res.json() as DefaultLocationResponse;
        if (data !== null) {
          const place = data.result.data.json as Place;
          setLocation({ name: place.name, id: place.id });
          setLatLong({ latitude: `${place.latitude}`, longitude: `${place.longitude}` });
        }
      }
    }

    if (user) {
      void getDefaultLocation();
    }
  }, [user]);

  useEffect(() => {
    const getForecastData = async () => {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latLong.latitude}&longitude=${latLong.longitude}&timezone=auto&hourly=weathercode,temperature_2m,relativehumidity_2m,precipitation_probability,precipitation,windspeed_10m,surface_pressure`);
      if (res.ok) {
        const data: Forecast = await res.json() as Forecast;
        if (!data) return;
        setForecast(data);
        setIsLoading(false);
      }
    }

    const getForecast = async () => {
      setIsLoading(true);
      void await getForecastData();
      setIsLoading(false);
    }

    if (latLong.latitude.length > 0 && latLong.longitude.length > 0) {
      void getForecast();
    }

  }, [latLong]);

  const getTableData = () => {
    if (!forecast) return [[0]];
    const dayData = new Array(24);
    for (let i = 0; i < 24; i++) {
      const hour: Array<number | string | undefined> = [];
      Object.entries(forecast.hourly)
        .forEach(([key, value]) => {
          if (!Array.isArray(value) || value[24 * day + i] === undefined) throw new Error("Your array isn't what you think");
          hour.push(key === "weathercode" && weatherIcons.has(Number(value[24 * day + i])) ? weatherIcons.get(Number(value[24 * day + i])) : value[24 * day + i] as number | string)
        });
      dayData.push(hour);
    }

    return dayData as Array<number[] | string[]>;
  }

  const tableData = getTableData();

  const { data: placesData } = api.location.getPlacesByName.useQuery({ name: placeQuery }, {
    enabled: placeQuery.length > 0
  });

  if (placesData) {
    setPlaces(placesData);
    setPlaceQuery('');
    setShowModal(true);
  }

  const changeLocation = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    try {
      if (!query || query.length == 0) throw new Error("Expected query to have a value initial");
      const places = query.split(',');
      if (!places[0]) throw new Error("Expected query to have a value");
      setPlaceQuery(places[0]);
      return placesData;
    } catch (err) {
      toast.error("Expected query to have a value");
      setIsLoading(false);
    }
  }

  if (showModal && places && places.length > 0) {
    return (
      <Modal
        places={places}
        setLatLong={setLatLong}
        setShowModal={setShowModal}
        setLocation={setLocation}
        setQuery={setQuery}
        setPlaces={setPlaces}
        setIsLoading={(setIsLoading)}
      />
    )
  }
  else {
    return (
      <Layout>
        {!isLoading && !showModal &&

          (<section className="flex flex-col md:flex-row gap-4 justify-between items-center px-1 py-4">
            <form className="flex flex-col md:flex-row gap-4" onSubmit={(e) => { void changeLocation(e) }}>
              <input
                onChange={(e) => setQuery(e.target.value)}
                value={query}
                placeholder="City name"
                className="border-2 border-grey rounded p-2"
              />
              <button className="bg-sky-500 rounded p-2  px-4">
                Submit
              </button>
            </form>
            {!isLoading && forecast && (
              <div className="pb-4 flex gap-2">
                <label htmlFor="day">Select date:
                  <select
                    name="day"
                    id="day"
                    value={day}
                    onChange={e => setDay(Number(e.target.value))}
                    className="ml-4 p-2 rounded"
                  >
                    {new Array(7).fill(0).map((_, i) => <option key={uniqId.default()} value={i}>{String(forecast.hourly.time[24 * i]).split("T")[0]}</option>)}
                  </select>
                </label>
                {user && <SetDefaultLocation location={location} />}
              </div>
            )}
          </section>)}
        {!isLoading && !showModal && forecast && (
          <section className="w-full flex justify-center items-center gap-4">
            <DailyHighLow forecast={forecast} setDay={setDay} />
          </section>
        )}
        {isLoading &&
          <div className="h-full">
            <LoadingSpinner />
          </div>
        }
        {!isLoading && forecast && (
          <section className="w-full grid xl:grid-cols-2 gap-4 mb-8">
            <section>
              <WeatherTable
                tableData={tableData}
                tableHeaders={Object.keys(forecast.hourly)}
                tableUnits={Object.values(forecast.hourly_units)}
                location={location.name}
              />
            </section>
            <WeatherCharts forecast={forecast} day={day} />
          </section>
        )}
      </Layout>
    )
  }
}

export default Weather;