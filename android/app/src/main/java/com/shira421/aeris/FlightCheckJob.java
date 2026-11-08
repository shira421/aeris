package com.shira421.aeris;

import android.app.job.JobParameters;
import android.app.job.JobService;

/** Background check of saved flights with alerts on (scheduled by FlightWatch). */
public final class FlightCheckJob extends JobService {
    private Thread worker;

    @Override
    public boolean onStartJob(final JobParameters params) {
        worker = new Thread(() -> {
            FlightWatch.checkAll(getApplicationContext());
            jobFinished(params, false);
        }, "aeris-flight-check");
        worker.start();
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        if (worker != null) worker.interrupt();
        return true;
    }
}
